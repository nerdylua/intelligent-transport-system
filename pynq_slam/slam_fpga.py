from __future__ import annotations
import os
import time
import numpy as np
from parse_carmen import parse_carmen_log
from preprocess import (
    polar_to_cartesian,
    transform_to_world,
    OccupancyGrid,
    GRID_RESOLUTION,
    GRID_SIZE,
)
from slam_cpu_baseline import generate_candidates, score_candidate

USE_FPGA = os.environ.get("USE_FPGA", "0") == "1"


def _init_fpga() -> dict:
    """
    Initialize PYNQ overlay and allocate DMA buffers matching the
    3-port HLS IP interface (gmem0=scan, gmem1=map, gmem2=result).
    """
    from pynq import Overlay, allocate

    overlay = Overlay("csm_accel.bit")
    csm_ip = overlay.csm_batch_accel_0
    dma_scan = overlay.axi_dma_scan
    dma_map = overlay.axi_dma_map
    dma_result = overlay.axi_dma_result

    max_scan_points = 720
    scan_buffer = allocate(shape=(max_scan_points * 2,), dtype=np.float32)
    map_buffer = allocate(shape=(GRID_SIZE * GRID_SIZE,), dtype=np.float32)
    result_buffer = allocate(shape=(3,), dtype=np.float32)

    return {
        "overlay": overlay,
        "csm_ip": csm_ip,
        "dma_scan": dma_scan,
        "dma_map": dma_map,
        "dma_result": dma_result,
        "scan_buffer": scan_buffer,
        "map_buffer": map_buffer,
        "result_buffer": result_buffer,
    }


def _process_scan_fpga(
    hw: dict,
    local_x: np.ndarray,
    local_y: np.ndarray,
    grid: OccupancyGrid,
    pred_x: float,
    pred_y: float,
    pred_theta: float,
) -> tuple[float, float, float]:
    """
    Send scan and map to FPGA via separate DMA channels matching the
    HLS IP's 3-port AXI interface, return best (x, y, theta).
    """
    csm_ip = hw["csm_ip"]
    n_points = len(local_x)
    csm_ip.write(0x10, n_points)
    csm_ip.write(0x18, GRID_SIZE)
    csm_ip.write(0x20, GRID_SIZE)

    scan_buf = hw["scan_buffer"]
    scan_data = np.column_stack([local_x, local_y]).flatten().astype(np.float32)
    scan_buf[:len(scan_data)] = scan_data

    map_buf = hw["map_buffer"]
    likelihood = grid.get_likelihood_field()
    map_flat = likelihood.flatten().astype(np.float32)
    map_buf[:len(map_flat)] = map_flat

    result_buf = hw["result_buffer"]
    result_buf[:] = [pred_x, pred_y, pred_theta]

    hw["dma_scan"].sendchannel.transfer(scan_buf)
    hw["dma_map"].sendchannel.transfer(map_buf)
    hw["dma_result"].recvchannel.transfer(result_buf)

    hw["dma_scan"].sendchannel.wait()
    hw["dma_map"].sendchannel.wait()
    hw["dma_result"].recvchannel.wait()

    return float(result_buf[0]), float(result_buf[1]), float(result_buf[2])


def run_slam_fpga(
    scans: list[dict],
    verbose: bool = True,
) -> tuple[np.ndarray, np.ndarray, list[float]]:
    """
    Run FPGA-accelerated CSM SLAM.
    Falls back to CPU if USE_FPGA is not set or hardware init fails.

    Returns same format as slam_cpu_baseline.run_slam_cpu().
    """
    hw = None
    if USE_FPGA:
        try:
            hw = _init_fpga()
            if verbose:
                print("FPGA overlay loaded successfully")
        except Exception as e:
            print(f"FPGA init failed ({e}), falling back to CPU")
            hw = None

    grid = OccupancyGrid.from_scans(scans)
    trajectory = []
    timings = []
    current_x, current_y, current_theta = scans[0]["pose"]

    for i, scan in enumerate(scans):
        local_x, local_y = polar_to_cartesian(scan["ranges"], scan["n_rays"])

        if i == 0:
            best_x, best_y, best_theta = current_x, current_y, current_theta
            timings.append(0.0)
        else:
            odom_x, odom_y, odom_theta = scan["odom"]
            prev_odom = scans[i - 1]["odom"]
            dx = odom_x - prev_odom[0]
            dy = odom_y - prev_odom[1]
            dtheta = odom_theta - prev_odom[2]

            pred_x = current_x + dx
            pred_y = current_y + dy
            pred_theta = current_theta + dtheta

            t_csm_start = time.perf_counter()

            if hw is not None:
                best_x, best_y, best_theta = _process_scan_fpga(
                    hw, local_x, local_y, grid, pred_x, pred_y, pred_theta
                )
            else:
                candidates = generate_candidates(pred_x, pred_y, pred_theta)
                best_score = -1
                best_x, best_y, best_theta = pred_x, pred_y, pred_theta
                likelihood = grid.get_likelihood_field()
                for cx, cy, ct in candidates:
                    score = score_candidate(
                        local_x, local_y, cx, cy, ct, grid, likelihood
                    )
                    if score > best_score:
                        best_score = score
                        best_x, best_y, best_theta = cx, cy, ct

            elapsed_csm = time.perf_counter() - t_csm_start
            timings.append(elapsed_csm)

        current_x, current_y, current_theta = best_x, best_y, best_theta
        trajectory.append([best_x, best_y, best_theta])

        scan_copy = dict(scan)
        scan_copy["pose"] = (best_x, best_y, best_theta)
        grid.update(scan_copy)

        if verbose and (i + 1) % 50 == 0:
            mode = "FPGA" if hw else "CPU-fallback"
            avg_ms = np.mean(timings[-50:]) * 1000
            print(f"  [{mode}] scan {i + 1}/{len(scans)}: avg CSM {avg_ms:.1f} ms/scan")

    trajectory = np.array(trajectory)
    occ_grid = grid.get_binary_map()
    return trajectory, occ_grid, timings


if __name__ == "__main__":
    import sys

    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join("..", "intel.log.txt")
    max_scans = int(sys.argv[2]) if len(sys.argv) > 2 else 200

    print(f"USE_FPGA={USE_FPGA}")
    print(f"Parsing {path}...")
    scans = parse_carmen_log(path)
    scans = scans[:max_scans]
    print(f"Running SLAM on {len(scans)} scans...")

    trajectory, occ_grid, timings = run_slam_fpga(scans)

    os.makedirs("output", exist_ok=True)
    np.save("output/trajectory.npy", trajectory)
    np.save("output/occupancy_grid.npy", occ_grid)

    mode = "FPGA" if USE_FPGA else "CPU-fallback"
    print(f"\n[{mode}] Results:")
    print(f"  Trajectory: {trajectory.shape}")
    print(f"  Grid: {occ_grid.shape}, occupied: {int(occ_grid.sum())}")
    print(f"  Avg CSM time/scan: {np.mean(timings)*1000:.1f} ms")
