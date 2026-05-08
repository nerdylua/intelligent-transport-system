import asyncio
import csv
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree as ET

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ITS Pipeline Server")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
VENV_PYTHON = str(PROJECT_ROOT / ".venv" / "Scripts" / "python.exe")
UXSIM_OUTPUT = PROJECT_ROOT / "simulation" / "uxsim" / "output"
SUMO_DIR = PROJECT_ROOT / "simulation" / "sumo"

ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")

PIPELINES = {
    "sumo": {
        "name": "SUMO Traffic Simulation",
        "script": str(PROJECT_ROOT / "simulation" / "sumo" / "run_sumo.py"),
        "cwd": str(PROJECT_ROOT / "simulation" / "sumo"),
    },
    "dql": {
        "name": "DQL Adaptive Signal Training",
        "script": str(PROJECT_ROOT / "simulation" / "uxsim" / "adaptive_signal_dql.py"),
        "cwd": str(PROJECT_ROOT / "simulation" / "uxsim"),
    },
    "slam": {
        "name": "SLAM Benchmark",
        "script": str(PROJECT_ROOT / "pynq_slam" / "benchmark.py"),
        "cwd": str(PROJECT_ROOT / "pynq_slam"),
        "args": [
            str(PROJECT_ROOT / "lidar_dataset" / "intel.log.txt"),
            "200",
        ],
    },
}

METRIC_PATTERNS: dict[str, list[tuple[re.Pattern, callable]]] = {
    "slam": [
        (
            re.compile(r"CPU CSM avg:\s*([\d.]+)\s*ms/scan\s*\(([\d.]+)s total\)"),
            lambda m: {"type": "cpu_result", "avg_ms": float(m.group(1)), "total_s": float(m.group(2))},
        ),
        (
            re.compile(r"FPGA CSM avg:\s*([\d.]+)\s*ms/scan"),
            lambda m: {"type": "fpga_result", "avg_ms": float(m.group(1))},
        ),
        (
            re.compile(r"Speedup:\s*([\d.]+)x"),
            lambda m: {"type": "speedup", "value": float(m.group(1))},
        ),
        (
            re.compile(r"Scans processed:\s*(\d+)"),
            lambda m: {"type": "progress_total", "total": int(m.group(1))},
        ),
    ],
    "dql": [
        (
            re.compile(r"ep\s+(\d+):\s*delay=([\d.]+)s"),
            lambda m: {"type": "episode", "episode": int(m.group(1)), "delay": float(m.group(2))},
        ),
        (
            re.compile(r"Greedy replay delay:\s*([\d.]+)s"),
            lambda m: {"type": "greedy_result", "delay": float(m.group(1))},
        ),
    ],
    "sumo": [
        (
            re.compile(r"collected\s+(\d+)\s+scans"),
            lambda m: {"type": "scan_progress", "scans": int(m.group(1))},
        ),
        (
            re.compile(r"Done:\s+(\d+)\s+scans"),
            lambda m: {"type": "complete", "total_scans": int(m.group(1))},
        ),
    ],
}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "python": VENV_PYTHON,
        "project_root": str(PROJECT_ROOT),
        "pipelines": list(PIPELINES.keys()),
    }


@app.get("/simulation/summary")
async def simulation_summary():
    return {
        "uxsim": _read_uxsim_summary(),
        "sumo": _read_sumo_summary(),
    }


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    processes: dict[str, asyncio.subprocess.Process] = {}

    async def send(msg: dict):
        try:
            await websocket.send_json(msg)
        except Exception:
            pass

    async def run_pipeline(pipeline_id: str):
        config = PIPELINES[pipeline_id]
        script = config["script"]
        script_args = [str(a) for a in config.get("args", [])]
        working_dir = str(config.get("cwd", PROJECT_ROOT))

        await send({"type": "status", "pipeline": pipeline_id, "status": "running"})
        await send({
            "type": "log",
            "pipeline": pipeline_id,
            "line": f"Starting {config['name']}...",
            "ts": _ts(),
        })

        try:
            proc = await asyncio.create_subprocess_exec(
                VENV_PYTHON, "-u", script, *script_args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=working_dir,
            )
            processes[pipeline_id] = proc

            async for raw_line in proc.stdout:
                line = raw_line.decode("utf-8", errors="replace").rstrip("\r\n")
                line = ANSI_RE.sub("", line)
                if not line:
                    continue

                await send({
                    "type": "log",
                    "pipeline": pipeline_id,
                    "line": line,
                    "ts": _ts(),
                })

                for pattern, extractor in METRIC_PATTERNS.get(pipeline_id, []):
                    match = pattern.search(line)
                    if match:
                        await send({
                            "type": "metric",
                            "pipeline": pipeline_id,
                            "data": extractor(match),
                        })

            code = await proc.wait()
            processes.pop(pipeline_id, None)

            status = "completed" if code == 0 else "error"
            await send({"type": "status", "pipeline": pipeline_id, "status": status, "exitCode": code})
            await send({
                "type": "log",
                "pipeline": pipeline_id,
                "line": f"Process exited with code {code}",
                "ts": _ts(),
            })

        except Exception as e:
            processes.pop(pipeline_id, None)
            await send({"type": "status", "pipeline": pipeline_id, "status": "error"})
            await send({
                "type": "log",
                "pipeline": pipeline_id,
                "line": f"Error: {e}",
                "ts": _ts(),
            })

    try:
        await send({"type": "connected", "pipelines": list(PIPELINES.keys())})

        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            action = data.get("action")
            pipeline_id = data.get("pipeline")

            if action == "run" and pipeline_id in PIPELINES:
                if pipeline_id in processes:
                    await send({
                        "type": "log",
                        "pipeline": pipeline_id,
                        "line": "Already running - stop it first",
                        "ts": _ts(),
                    })
                else:
                    asyncio.create_task(run_pipeline(pipeline_id))

            elif action == "stop" and pipeline_id in processes:
                proc = processes.pop(pipeline_id)
                proc.terminate()
                await send({"type": "status", "pipeline": pipeline_id, "status": "stopped"})
                await send({
                    "type": "log",
                    "pipeline": pipeline_id,
                    "line": "Process terminated by user",
                    "ts": _ts(),
                })

    except WebSocketDisconnect:
        for proc in processes.values():
            try:
                proc.terminate()
            except Exception:
                pass
        processes.clear()


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S.%f")[:-3]


def _read_uxsim_summary() -> dict:
    metrics_path = UXSIM_OUTPUT / "metrics.csv"
    fixed_path = UXSIM_OUTPUT / "fixed_metrics.csv"
    rows = _read_csv_dicts(metrics_path) or _read_csv_dicts(fixed_path)
    modes = {row.get("mode", f"row_{i}"): row for i, row in enumerate(rows)}

    fixed = modes.get("fixed")
    adaptive = modes.get("adaptive_dql")
    comparison = None
    if fixed and adaptive:
        fixed_delay = _float(fixed.get("avg_delay_s"))
        adaptive_delay = _float(adaptive.get("avg_delay_s"))
        fixed_speed = _float(fixed.get("avg_speed_mps"))
        adaptive_speed = _float(adaptive.get("avg_speed_mps"))
        fixed_completed = _float(fixed.get("trips_completed"))
        adaptive_completed = _float(adaptive.get("trips_completed"))
        comparison = {
            "speed_improvement": _ratio(adaptive_speed, fixed_speed),
            "delay_reduction_pct": _pct_reduction(fixed_delay, adaptive_delay),
            "completion_improvement": _ratio(adaptive_completed, fixed_completed),
        }

    artifacts = {
        name: _artifact_info(UXSIM_OUTPUT / name)
        for name in [
            "metrics.csv",
            "fixed_metrics.csv",
            "training_curve.png",
            "fixed_anim.gif",
            "adaptive_anim.gif",
        ]
    }

    return {
        "metrics_path": str(metrics_path.relative_to(PROJECT_ROOT)),
        "rows": rows,
        "comparison": comparison,
        "artifacts": artifacts,
    }


def _read_sumo_summary() -> dict:
    carmen_path = SUMO_DIR / "output" / "carmen_sumo.log"
    scan_count = 0
    ray_count = None
    start_ts = None
    end_ts = None

    if carmen_path.exists():
        with carmen_path.open("r", encoding="utf-8", errors="replace") as f:
            for line in f:
                if not line.startswith("FLASER "):
                    continue
                parts = line.split()
                scan_count += 1
                if len(parts) > 1 and ray_count is None:
                    ray_count = _int(parts[1])
                if len(parts) >= 10:
                    ts = _float(parts[-3])
                    if ts is not None:
                        start_ts = ts if start_ts is None else min(start_ts, ts)
                        end_ts = ts if end_ts is None else max(end_ts, ts)

    return {
        "config": _read_sumo_config(),
        "carmen": {
            "path": str(carmen_path.relative_to(PROJECT_ROOT)),
            "exists": carmen_path.exists(),
            "bytes": carmen_path.stat().st_size if carmen_path.exists() else 0,
            "scan_count": scan_count,
            "rays_per_scan": ray_count,
            "duration_s": round(end_ts - start_ts, 2) if start_ts is not None and end_ts is not None else None,
        },
    }


def _read_sumo_config() -> dict:
    config_path = SUMO_DIR / "simulation.sumocfg"
    route_path = SUMO_DIR / "routes.rou.xml"
    net_path = SUMO_DIR / "network.net.xml"
    summary: dict = {
        "config_path": str(config_path.relative_to(PROJECT_ROOT)),
        "step_length_s": None,
        "begin_s": None,
        "end_s": None,
        "routes": 0,
        "flows": 0,
        "traffic_light_phases": 0,
    }

    try:
        cfg_root = ET.parse(config_path).getroot()
        for key, tag in [("step_length_s", "step-length"), ("begin_s", "begin"), ("end_s", "end")]:
            node = cfg_root.find(f".//{tag}")
            summary[key] = _float(node.attrib.get("value")) if node is not None else None
    except (ET.ParseError, OSError):
        pass

    try:
        route_root = ET.parse(route_path).getroot()
        summary["routes"] = len(route_root.findall("route"))
        summary["flows"] = len(route_root.findall("flow"))
    except (ET.ParseError, OSError):
        pass

    try:
        net_root = ET.parse(net_path).getroot()
        summary["traffic_light_phases"] = len(net_root.findall(".//tlLogic/phase"))
    except (ET.ParseError, OSError):
        pass

    return summary


def _read_csv_dicts(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open("r", newline="", encoding="utf-8") as f:
        return [{k: _coerce(v) for k, v in row.items()} for row in csv.DictReader(f)]


def _artifact_info(path: Path) -> dict:
    return {
        "path": str(path.relative_to(PROJECT_ROOT)),
        "exists": path.exists(),
        "bytes": path.stat().st_size if path.exists() else 0,
    }


def _coerce(value: str | None):
    if value is None or value == "":
        return None
    number = _float(value)
    if number is None:
        return value
    return int(number) if number.is_integer() else number


def _float(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _int(value) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _ratio(numerator: float | None, denominator: float | None) -> float | None:
    if numerator is None or denominator in (None, 0):
        return None
    return round(numerator / denominator, 2)


def _pct_reduction(before: float | None, after: float | None) -> float | None:
    if before in (None, 0) or after is None:
        return None
    return round((before - after) / before * 100, 1)


if __name__ == "__main__":
    import uvicorn

    print(f"Project root: {PROJECT_ROOT}")
    print(f"Python: {VENV_PYTHON}")
    print(f"Pipelines: {list(PIPELINES.keys())}")
    uvicorn.run(app, host="0.0.0.0", port=8000)
