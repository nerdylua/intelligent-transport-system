# Intelligent Transport System

A full-stack platform for autonomous vehicle research combining microscopic/mesoscopic traffic simulation, FPGA-accelerated LiDAR SLAM, deep reinforcement learning for adaptive signal control, and interactive 3D visualization of real KITTI driving data.

## Quick Start

### Prerequisites

- **Python 3.9+** with [uv](https://docs.astral.sh/uv/) package manager
- **Node.js 18+** with npm
- **SUMO** (Simulation of Urban Mobility) -- install via `pip install eclipse-sumo` or [sumo.dlr.de](https://sumo.dlr.de/docs/Downloads.php)
- _Optional:_ PYNQ-Z2 FPGA board (for hardware-accelerated SLAM)

### Install Dependencies

```bash
# Python dependencies
uv sync

# Frontend dependencies
cd frontend; npm install
```

### Run

Start both the backend and frontend:

```bash
# Terminal 1 -- Backend (WebSocket server on :8000)
python backend/server.py

# Terminal 2 -- Frontend (Next.js on :3000)
cd frontend; npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

### Simulation Dashboard (`/simulation`)

Interactive dashboard with four animated sections:

- **Traffic Simulation** -- Canvas-rendered SUMO traffic across four topologies: 4-way intersection, signalised intersection (with animated signal phases), roundabout, and highway merge. Each view renders an ego vehicle with a LiDAR scan cone and surrounding traffic.
- **Adaptive Signal Control** -- Side-by-side comparison of DQL-trained adaptive signals vs fixed-timing baselines. Displays speed improvement (4x), delay reduction (64%), and trip completion rates via bar and radar charts.
- **LiDAR SLAM Pipeline** -- Animated 7-stage pipeline visualization: noise filter, polar-to-Cartesian, discretization, occupancy grid, likelihood field, correlative scan matching, and map update.
- **FPGA Acceleration Benchmark** -- Animated counters and charts showing 2,779x speedup for scan matching (CPU: 454.7ms vs FPGA: 0.164ms per scan), with breakdowns by acceleration source (parallel candidate evaluation, BRAM, pipelining, DMA).

### Pipeline Runner (`/pipeline`)

Run simulation and SLAM pipelines directly from the browser with real-time WebSocket log streaming:

| Pipeline | Script | Description |
|---|---|---|
| SUMO Traffic Sim | `simulation/sumo/run_sumo.py` | Ego vehicle with synthetic LiDAR in SUMO |
| DQL Signal Training | `simulation/uxsim/adaptive_signal_dql.py` | 50-episode RL training for adaptive signals |
| SLAM Benchmark | `pynq_slam/benchmark.py` | CPU vs FPGA scan matching benchmark |

Each pipeline provides start/stop controls and live metric extraction.

### 3D AV Visualization (`/visualization`)

Full autonomous vehicle scene viewer built with Three.js / React Three Fiber:

- **Point clouds** -- Binary LiDAR frames with ground/object classification coloring
- **3D bounding boxes** -- Labeled detections for cars, trucks, cyclists, and pedestrians
- **Ego vehicle** -- Catmull-Rom spline-interpolated positioning with chase camera
- **Trajectory** -- Color-coded path with past/future distinction
- **Camera feed** -- Synchronized MP4 video overlay
- **Playback controls** -- Play/pause, step, speed (0.25x--4x), loop, keyboard shortcuts (`Space`, `Arrow` keys)
- **Stream toggles** -- Show/hide individual layers (vehicle, trajectory, objects, labels, LiDAR, camera, grid)
- **Sequence selector** -- Switch between KITTI driving sequences

## Project Structure

```
.
├── backend/
│   └── server.py                # FastAPI WebSocket server (pipeline orchestration)
├── frontend/                    # Next.js 16 / React 19 / TypeScript
│   ├── app/                     # App Router pages (simulation, pipeline, visualization)
│   ├── components/              # UI components (Shadcn, Three.js scene, charts)
│   └── hooks/                   # WebSocket, playback, and scene data hooks
├── simulation/
│   ├── sumo/                    # SUMO microscopic simulation + synthetic LiDAR
│   │   ├── run_sumo.py          # Ego vehicle with ray-cast LiDAR logging
│   │   ├── carmen_writer.py     # Carmen FLASER format writer
│   │   ├── network.net.xml      # Road network definition
│   │   └── simulation.sumocfg   # SUMO config (150s duration, 0.1s step)
│   └── uxsim/                   # UXsim mesoscopic simulation
│       ├── fixed_signal.py      # Fixed-timing signal baseline
│       └── adaptive_signal_dql.py  # DQL adaptive signal controller
├── pynq_slam/                   # FPGA-accelerated LiDAR SLAM
│   ├── parse_carmen.py          # Carmen log parser
│   ├── preprocess.py            # Occupancy grid + Bresenham ray-tracing
│   ├── slam_cpu_baseline.py     # CPU correlative scan matching
│   ├── slam_fpga.py             # PYNQ-Z2 FPGA-accelerated CSM
│   └── benchmark.py             # CPU vs FPGA benchmark runner
├── scripts/
│   ├── generate_scene.py        # Generate synthetic KITTI-like scene data
│   └── preprocess_kitti.py      # Preprocess real KITTI sequences for visualization
├── kitti_datasets/              # Real KITTI driving sequences (LiDAR, GPS/IMU, camera)
├── lidar_dataset/               # Intel Research Lab Carmen LiDAR dataset
├── output/                      # SLAM benchmark outputs (grids, trajectories, timing)
└── pyproject.toml               # Python project config (uv)
```

## Running Individual Components

### SUMO Traffic Simulation

```bash
python simulation/sumo/run_sumo.py [--gui] [--config path] [--output path]
```

Runs an ego vehicle through the SUMO network with synthetic LiDAR ray-casting. Generates Carmen FLASER log files for downstream SLAM processing. Use `--gui` to open the SUMO GUI.

### Adaptive Signal Control (DQL)

```bash
# Fixed-timing baseline
python simulation/uxsim/fixed_signal.py

# DQL adaptive training (50 episodes)
python simulation/uxsim/adaptive_signal_dql.py
```

Trains a Deep Q-Learning agent (3-layer MLP, experience replay, epsilon-greedy) on a 4-intersection grid. The agent observes per-link queue counts and learns signal phase assignments to minimize vehicle delay. Outputs training curves, replay GIFs, and comparison metrics.

### SLAM Benchmark

```bash
# CPU-only benchmark
python pynq_slam/benchmark.py [log_path] [max_scans]

# With FPGA hardware (requires PYNQ-Z2)
USE_FPGA=1 python pynq_slam/slam_fpga.py [log_path] [max_scans]
```

Runs correlative scan matching on the Intel Research Lab dataset. The CPU baseline searches ~4,851 pose candidates per scan; the FPGA accelerator achieves a 2,779x speedup via HLS-synthesized parallel evaluation on the Zynq-7000 SoC.

### Data Preprocessing

```bash
# Generate synthetic scene data for the 3D viewer
python scripts/generate_scene.py

# Preprocess real KITTI sequences
python scripts/preprocess_kitti.py [-s 0005|0093] [-p max_points]
```

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS, Shadcn UI, Magic UI |
| 3D Rendering | Three.js, React Three Fiber, React Three Drei |
| Charts | Recharts, Framer Motion |
| Backend | FastAPI, WebSockets, uvicorn |
| Simulation | SUMO (traci), UXsim |
| ML/RL | PyTorch, Gymnasium |
| SLAM | NumPy, Bresenham ray-tracing, correlative scan matching |
| FPGA | PYNQ (Xilinx Zynq-7000), HLS, AXI DMA |
| Data | KITTI dataset, Carmen FLASER format, NumPy arrays |

## Key Results

| Metric | Value |
|---|---|
| FPGA vs CPU speedup (scan matching) | 2,779x |
| CPU CSM latency | 454.7 ms/scan |
| FPGA CSM latency | 0.164 ms/scan |
| Adaptive vs fixed signal -- delay reduction | 64% |
| Adaptive vs fixed signal -- speed improvement | 4.0x |
| Adaptive vs fixed signal -- trip completions | 4.0x more |