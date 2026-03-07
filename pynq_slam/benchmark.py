from __future__ import annotations
import json
import os
import sys
import time
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from parse_carmen import parse_carmen_log
from slam_cpu_baseline import run_slam_cpu

REPORTED_SPEEDUP = 2779  # from Report.pdf: CPU 0.803s -> FPGA 0.000289s

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")


def _plot_comparison(results: dict, output_dir: str) -> None:
    """Generate side-by-side CPU vs FPGA comparison plots."""
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle(
        f"CPU vs FPGA SLAM Benchmark — {results['dataset']} ({results['num_scans']} scans)",
        fontsize=14, fontweight="bold",
    )

    cpu_per_scan = results["cpu"]["per_scan_ms"]
    fpga_per_scan = results["fpga"].get("per_scan_ms", None)

    ax1 = axes[0, 0]
    ax1.plot(cpu_per_scan, "b-", alpha=0.7, linewidth=1, label="CPU")
    ax1.set_xlabel("Scan Index")
    ax1.set_ylabel("CSM Time (ms)")
    ax1.set_title("Per-Scan CSM Execution Time (CPU)")
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    ax2 = axes[0, 1]
    categories = ["CPU", "FPGA"]
    avg_times = [results["cpu"]["avg_ms_per_scan"], results["fpga"]["avg_ms_per_scan"]]
    colors = ["#3b82f6", "#10b981"]
    bars = ax2.bar(categories, avg_times, color=colors, width=0.5)
    for bar, val in zip(bars, avg_times):
        label = f"{val:.1f} ms" if val >= 0.1 else f"{val:.4f} ms"
        ax2.text(
            bar.get_x() + bar.get_width() / 2, bar.get_height(),
            label, ha="center", va="bottom", fontweight="bold", fontsize=11,
        )
    ax2.set_ylabel("Avg CSM Time per Scan (ms)")
    ax2.set_title("Average CSM Time Comparison")
    ax2.set_yscale("log")
    ax2.grid(True, alpha=0.3, axis="y")

    ax3 = axes[1, 0]
    total_times = [results["cpu"]["total_seconds"], results["fpga"]["total_seconds"]]
    bars = ax3.bar(categories, total_times, color=colors, width=0.5)
    for bar, val in zip(bars, total_times):
        label = f"{val:.2f}s" if val >= 0.01 else f"{val:.4f}s"
        ax3.text(
            bar.get_x() + bar.get_width() / 2, bar.get_height(),
            label, ha="center", va="bottom", fontweight="bold", fontsize=11,
        )
    ax3.set_ylabel("Total CSM Time (seconds)")
    ax3.set_title("Total Processing Time")
    ax3.set_yscale("log")
    ax3.grid(True, alpha=0.3, axis="y")

    ax4 = axes[1, 1]
    speedup = results["speedup"]
    source = results["fpga"]["source"]
    ax4.barh(["Speedup"], [speedup], color="#f59e0b", height=0.4)
    ax4.text(
        speedup / 2, 0,
        f"{speedup:.0f}x",
        ha="center", va="center", fontweight="bold", fontsize=18, color="white",
    )
    ax4.set_xlabel("Speedup Factor (CPU / FPGA)")
    source_label = "measured" if source == "measured" else "estimated"
    ax4.set_title(f"FPGA Speedup ({source_label})")
    ax4.grid(True, alpha=0.3, axis="x")

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "cpu_vs_fpga_comparison.png"), dpi=150)
    plt.close()


def _plot_occupancy(occ_grid: np.ndarray, trajectory: np.ndarray,
                    output_dir: str, resolution: float = 0.1,
                    origin_x: float = -40.0, origin_y: float = -40.0) -> None:
    """Plot the occupancy grid with trajectory overlay, axes in metres."""
    fig, ax = plt.subplots(figsize=(12, 8))
    extent = [origin_x, origin_x + occ_grid.shape[1] * resolution,
              origin_y, origin_y + occ_grid.shape[0] * resolution]
    ax.imshow(occ_grid, cmap="gray_r", origin="lower", extent=extent)
    ax.plot(trajectory[:, 0], trajectory[:, 1], "r-", linewidth=1.2, label="Estimated path")
    ax.plot(trajectory[0, 0], trajectory[0, 1], "go", markersize=8, label="Start")
    ax.plot(trajectory[-1, 0], trajectory[-1, 1], "rs", markersize=8, label="End")
    ax.set_xlabel("X (metres)")
    ax.set_ylabel("Y (metres)")
    ax.set_title(f"Occupancy Grid Map ({len(trajectory)} scans)")
    ax.legend()
    ax.set_aspect("equal")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "occupancy_map.png"), dpi=150)
    plt.close()


def run_benchmark(
    log_path: str,
    max_scans: int = 200,
    output_dir: str | None = None,
) -> dict:
    """
    Run CPU SLAM, compute results, and generate timing comparison.
    """
    if output_dir is None:
        output_dir = OUTPUT_DIR
    os.makedirs(output_dir, exist_ok=True)

    print(f"Parsing {log_path}...")
    scans = parse_carmen_log(log_path)
    scans = scans[:max_scans]
    print(f"Benchmarking on {len(scans)} scans\n")

    print("=" * 50)
    print("Running CPU baseline SLAM (CSM-only timing)...")
    print("=" * 50)
    traj_cpu, occ_cpu, timings_cpu, grid_obj = run_slam_cpu(scans)

    csm_timings = [t for t in timings_cpu if t > 0]
    cpu_avg_ms = float(np.mean(csm_timings)) * 1000 if csm_timings else 0.0
    cpu_total_s = float(np.sum(timings_cpu))

    fpga_avg_ms = cpu_avg_ms / REPORTED_SPEEDUP
    fpga_total_s = cpu_total_s / REPORTED_SPEEDUP
    fpga_source = "estimated_from_reported_speedup"

    try:
        from slam_fpga import run_slam_fpga, USE_FPGA as FPGA_ACTIVE
        if FPGA_ACTIVE:
            print("\n" + "=" * 50)
            print("Running FPGA-accelerated SLAM...")
            print("=" * 50)
            traj_fpga, occ_fpga, timings_fpga = run_slam_fpga(scans)
            fpga_csm = [t for t in timings_fpga if t > 0]
            fpga_avg_ms = float(np.mean(fpga_csm)) * 1000 if fpga_csm else 0.0
            fpga_total_s = float(np.sum(timings_fpga))
            fpga_source = "measured"
    except ImportError:
        pass

    actual_speedup = cpu_avg_ms / fpga_avg_ms if fpga_avg_ms > 0 else REPORTED_SPEEDUP

    np.save(os.path.join(output_dir, "trajectory.npy"), traj_cpu)
    np.save(os.path.join(output_dir, "occupancy_grid.npy"), occ_cpu)

    results = {
        "dataset": os.path.basename(log_path),
        "num_scans": len(scans),
        "cpu": {
            "avg_ms_per_scan": round(cpu_avg_ms, 3),
            "total_seconds": round(cpu_total_s, 3),
            "per_scan_ms": [round(t * 1000, 3) for t in timings_cpu],
        },
        "fpga": {
            "avg_ms_per_scan": round(fpga_avg_ms, 6),
            "total_seconds": round(fpga_total_s, 6),
            "source": fpga_source,
        },
        "speedup": round(actual_speedup, 1),
        "reported_speedup": REPORTED_SPEEDUP,
        "trajectory_shape": list(traj_cpu.shape),
        "grid_shape": list(occ_cpu.shape),
        "occupied_cells": int(occ_cpu.sum()),
    }

    json_path = os.path.join(output_dir, "timing_results.json")
    with open(json_path, "w") as f:
        json.dump(results, f, indent=2)

    print("\n" + "=" * 50)
    print("BENCHMARK RESULTS (CSM-only timing)")
    print("=" * 50)
    print(f"  Dataset: {results['dataset']}")
    print(f"  Scans processed: {results['num_scans']}")
    print(f"  CPU CSM avg: {cpu_avg_ms:.1f} ms/scan ({cpu_total_s:.2f}s total)")
    print(f"  FPGA CSM avg: {fpga_avg_ms:.4f} ms/scan ({fpga_total_s:.4f}s total)")
    print(f"  Speedup: {actual_speedup:.1f}x ({fpga_source})")
    print(f"  Trajectory: {traj_cpu.shape}")
    print(f"  Grid: {occ_cpu.shape}, occupied: {int(occ_cpu.sum())}")

    print(f"  Grid: {occ_cpu.shape[0]}x{occ_cpu.shape[0]} cells, "
          f"origin=({grid_obj.origin_x:.1f}, {grid_obj.origin_y:.1f}), "
          f"res={grid_obj.resolution}m")

    print("\nGenerating comparison plots...")
    _plot_comparison(results, output_dir)
    _plot_occupancy(occ_cpu, traj_cpu, output_dir,
                    resolution=grid_obj.resolution,
                    origin_x=grid_obj.origin_x, origin_y=grid_obj.origin_y)
    print(f"Saved to: {output_dir}/")
    print(f"  timing_results.json, cpu_vs_fpga_comparison.png, occupancy_map.png")

    return results


if __name__ == "__main__":
    log_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join("..", "intel.log.txt")
    max_scans = int(sys.argv[2]) if len(sys.argv) > 2 else 200
    run_benchmark(log_path, max_scans)
