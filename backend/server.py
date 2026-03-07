import asyncio
import json
import re
import sys
from datetime import datetime
from pathlib import Path

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

ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")

PIPELINES = {
    "sumo": {
        "name": "SUMO Traffic Simulation",
        "script": str(PROJECT_ROOT / "simulation" / "sumo" / "run_sumo.py"),
    },
    "dql": {
        "name": "DQL Adaptive Signal Training",
        "script": str(PROJECT_ROOT / "simulation" / "uxsim" / "adaptive_signal_dql.py"),
    },
    "slam": {
        "name": "SLAM Benchmark",
        "script": str(PROJECT_ROOT / "pynq_slam" / "benchmark.py"),
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

        await send({"type": "status", "pipeline": pipeline_id, "status": "running"})
        await send({
            "type": "log",
            "pipeline": pipeline_id,
            "line": f"Starting {config['name']}...",
            "ts": _ts(),
        })

        try:
            proc = await asyncio.create_subprocess_exec(
                VENV_PYTHON, "-u", script,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=str(PROJECT_ROOT),
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
                        "line": "Already running — stop it first",
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


if __name__ == "__main__":
    import uvicorn

    print(f"Project root: {PROJECT_ROOT}")
    print(f"Python: {VENV_PYTHON}")
    print(f"Pipelines: {list(PIPELINES.keys())}")
    uvicorn.run(app, host="0.0.0.0", port=8000)
