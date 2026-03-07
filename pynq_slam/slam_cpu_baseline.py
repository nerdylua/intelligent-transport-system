from __future__ import annotations
import time
import numpy as np
from parse_carmen import parse_carmen_log
from preprocess import (
    polar_to_cartesian,
    transform_to_world,
    OccupancyGrid,
    GRID_RESOLUTION,
)


# CSM search window: how far around the current estimate to search
SEARCH_XY = 0.5       # metres, +/- in x and y
SEARCH_THETA = 0.1    # radians, +/- in heading
STEP_XY = 0.05        # metres per step
STEP_THETA = 0.02     # radians per step


def generate_candidates(
    x: float, y: float, theta: float,
) -> np.ndarray:
    """Generate a grid of pose candidates around (x, y, theta)."""
    xs = np.arange(x - SEARCH_XY, x + SEARCH_XY + STEP_XY, STEP_XY)
    ys = np.arange(y - SEARCH_XY, y + SEARCH_XY + STEP_XY, STEP_XY)
    ts = np.arange(theta - SEARCH_THETA, theta + SEARCH_THETA + STEP_THETA, STEP_THETA)

    candidates = []
    for cx in xs:
        for cy in ys:
            for ct in ts:
                candidates.append((cx, cy, ct))
    return candidates


def score_candidate(
    local_x: np.ndarray,
    local_y: np.ndarray,
    cx: float,
    cy: float,
    ctheta: float,
    grid: OccupancyGrid,
    prob_map: np.ndarray | None = None,
) -> float:
    """
    Score a pose candidate by transforming scan points and checking
    how many land on occupied cells in the current map.
    """
    wx, wy = transform_to_world(local_x, local_y, cx, cy, ctheta)

    cols = ((wx - grid.origin_x) / grid.resolution).astype(np.int32)
    rows = ((wy - grid.origin_y) / grid.resolution).astype(np.int32)

    valid = (
        (cols >= 0) & (cols < grid.size) &
        (rows >= 0) & (rows < grid.size)
    )

    if valid.sum() == 0:
        return 0.0

    if prob_map is None:
        prob_map = grid.get_probability_map()
    score = prob_map[rows[valid], cols[valid]].sum()
    return float(score)


def run_slam_cpu(
    scans: list[dict],
    verbose: bool = True,
) -> tuple[np.ndarray, np.ndarray, list[float]]:
    """
    Run CPU-based CSM SLAM on a list of parsed scans.

    Returns:
        trajectory:  np.ndarray (N, 3) -- estimated [x, y, theta] per scan
        occ_grid:    np.ndarray (H, W) -- final occupancy grid (binary)
        timings:     list[float]       -- per-scan processing time in seconds
    """
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
            prev_odom_x, prev_odom_y, prev_odom_theta = scans[i - 1]["odom"]
            dx = odom_x - prev_odom_x
            dy = odom_y - prev_odom_y
            dtheta = odom_theta - prev_odom_theta

            pred_x = current_x + dx
            pred_y = current_y + dy
            pred_theta = current_theta + dtheta

            t_csm_start = time.perf_counter()

            candidates = generate_candidates(pred_x, pred_y, pred_theta)
            best_score = -1
            best_x, best_y, best_theta = pred_x, pred_y, pred_theta

            likelihood = grid.get_likelihood_field()
            for cx, cy, ct in candidates:
                score = score_candidate(local_x, local_y, cx, cy, ct, grid, likelihood)
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

        if verbose and (i + 1) % 10 == 0:
            avg_ms = np.mean(timings[-10:]) * 1000
            print(f"  scan {i + 1}/{len(scans)}: avg CSM {avg_ms:.1f} ms/scan")

    trajectory = np.array(trajectory)
    occ_grid = grid.get_binary_map()
    return trajectory, occ_grid, timings, grid


if __name__ == "__main__":
    import sys
    import os

    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join("..", "intel.log.txt")
    max_scans = int(sys.argv[2]) if len(sys.argv) > 2 else 200

    print(f"Parsing {path}...")
    scans = parse_carmen_log(path)
    scans = scans[:max_scans]
    print(f"Running CPU SLAM on {len(scans)} scans...")

    trajectory, occ_grid, timings, _ = run_slam_cpu(scans)

    os.makedirs("output", exist_ok=True)
    np.save("output/trajectory.npy", trajectory)
    np.save("output/occupancy_grid.npy", occ_grid)

    print(f"\nResults:")
    print(f"  Trajectory shape: {trajectory.shape}")
    print(f"  Occupancy grid shape: {occ_grid.shape}")
    print(f"  Occupied cells: {int(occ_grid.sum())}")
    print(f"  Avg time/scan: {np.mean(timings)*1000:.1f} ms")
    print(f"  Total time: {sum(timings):.2f} s")
