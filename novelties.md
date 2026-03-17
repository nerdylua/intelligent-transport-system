# Novelties — FPGA-Accelerated LiDAR SLAM

## 1. Performance-Per-Watt at Embedded Scale

The real argument isn't speed alone — it's **speed per dollar per watt**. An NVIDIA Jetson AGX draws 10–30W and costs $500–$1000+. The PYNQ-Z2 draws ~1.5–2.5W total and costs ~$65–$130. Yet the system achieves **2779x speedup** over CPU, bringing average CSM time from **0.8031s/scan → 0.000289s/scan**. At 0.8s/scan the robot is always 800ms behind reality — real-time navigation is impossible. At 0.289ms/scan it comfortably meets real-time constraints. No prior work at this price-power point demonstrates this magnitude of speedup for CSM on a Zynq-class device.


## 2. Surgical Offloading — Only CSM, Not Everything

The hybrid split is deliberate and architecturally principled:

- **Preprocessing stays on CPU** — noise filtering, polar→Cartesian transform, discretization, and map updates are irregular, branchy, and data-dependent. FPGAs handle this poorly.
- **CSM goes to FPGA** — correlation over pose candidates is perfectly regular and embarrassingly parallel. No dependencies between candidates. Ideal for hardware.

The search space justifies this: with ±0.2m translation at 0.05m resolution and ±10° angular window at 1° steps, there are ~**1701 pose candidates/scan**, each requiring ~360 point transforms and grid lookups — roughly **612,360 operations/scan**. The CPU does this serially. The FPGA uses `#pragma HLS PIPELINE II=1` and `#pragma HLS UNROLL` to physically instantiate parallel compute units in the PL fabric, collapsing this to a single pipelined pass.


## 3. On-Die AXI-DMA + Shared DDR — No PCIe Bottleneck

On discrete CPU+FPGA systems, PCIe communication eats hundreds of microseconds. The Zynq-7000 SoC eliminates this — PS and PL share the same DDR controller on-die. The data path:

- CPU writes preprocessed scan to a **CMA buffer** (contiguous, DMA-capable DDR)
- **AXI DMA** transfers via **HP0 AXI port** (64-bit, up to 1066 MB/s) — CPU is free during transfer
- FPGA pulls the map window into **on-chip BRAM** (single-cycle access) for the duration of scan matching — avoids DDR latency inside the tight correlation loop
- Result pose 3-tuple written back, CPU reads after `recvchannel.wait()`

Transfer overhead is negligible (few KB scan, few hundred KB map window) relative to the 2779x compute gain.


## 4. Dual Input — Real + Synthetic Data

Most FPGA SLAM papers test on a single CARMEN dataset and stop there. This system supports:

- **Real CARMEN logs** (FLASER format) — real sensor noise, odometry drift, irregular timing
- **Synthetic data via eclipse/sume (GitHub)** — ground truth poses, controllable noise, configurable environments

This lets you decouple sensor artifacts from algorithm correctness — validate CSM on clean synthetic data, stress-test on noisy real data. It also makes the system fully reproducible without physical LiDAR hardware, which is a meaningful contribution for an embedded systems project.


## 5. We can say that the visualization endpoint computes the slam and renders the ui so fast due to our hybrid framework, else it would take significantly more time

```

No academic FPGA SLAM paper at this level pipes output into an AV-grade visualization stack. This single design decision makes the full pipeline — real/synthetic sensor input → embedded FPGA compute → industry-standard visualization — architecturally resemble a production autonomous navigation system, which is the strongest novelty argument.