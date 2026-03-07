import os
import sys
import argparse
import math
import numpy as np

if "SUMO_HOME" not in os.environ:
    sumo_candidates = [
        r"C:\Program Files (x86)\Eclipse\Sumo",
        r"C:\Program Files\Eclipse\Sumo",
    ]
    for p in sumo_candidates:
        if os.path.isdir(p):
            os.environ["SUMO_HOME"] = p
            break

if "SUMO_HOME" in os.environ:
    sys.path.append(os.path.join(os.environ["SUMO_HOME"], "tools"))

import traci
from carmen_writer import write_carmen_log

# ── Ray-casting parameters (must match intel.log.txt format) ──
NUM_RAYS = 180
MAX_RANGE = 81.83
FOV = math.pi          # 180-degree front-facing
NOISE_STD = 0.02       # metres of Gaussian sensor noise
VEHICLE_RADIUS = 2.5   # treat other vehicles as circles with this radius

# ── Road boundary walls for ray-casting ──
# Defined as line segments [(x1,y1,x2,y2), ...] representing curbs/buildings.
# These form a corridor around the intersection matching the network geometry.
WALLS = [
    # West corridor north wall
    (-200, 5, -8, 5),
    # West corridor south wall
    (-200, -5, -8, -5),
    # East corridor north wall
    (8, 5, 200, 5),
    # East corridor south wall
    (8, -5, 200, -5),
    # North corridor west wall
    (-5, 8, -5, 200),
    # North corridor east wall
    (5, 8, 5, 200),
    # South corridor west wall
    (-5, -200, -5, -8),
    # South corridor east wall
    (5, -200, 5, -8),
    # Corner blocks (buildings at the four quadrants of the intersection)
    (-200, 5, -200, 50), (200, 5, 200, 50),
    (-200, -5, -200, -50), (200, -5, 200, -50),
]


def ray_segment_intersection(
    ox: float, oy: float, dx: float, dy: float,
    x1: float, y1: float, x2: float, y2: float,
) -> float:
    """
    Find the distance along ray (ox,oy)+t*(dx,dy) where it hits
    the segment (x1,y1)-(x2,y2). Returns MAX_RANGE+1 if no hit.
    """
    sx, sy = x2 - x1, y2 - y1
    denom = dx * sy - dy * sx
    if abs(denom) < 1e-12:
        return MAX_RANGE + 1

    t = ((x1 - ox) * sy - (y1 - oy) * sx) / denom
    u = ((x1 - ox) * dy - (y1 - oy) * dx) / denom

    if t > 0 and 0 <= u <= 1:
        return t
    return MAX_RANGE + 1


def ray_circle_intersection(
    ox: float, oy: float, dx: float, dy: float,
    cx: float, cy: float, r: float,
) -> float:
    """Distance along ray to the nearest intersection with circle (cx,cy,r)."""
    fx, fy = ox - cx, oy - cy
    a = dx * dx + dy * dy
    b = 2 * (fx * dx + fy * dy)
    c = fx * fx + fy * fy - r * r
    disc = b * b - 4 * a * c
    if disc < 0:
        return MAX_RANGE + 1
    disc_sqrt = math.sqrt(disc)
    t1 = (-b - disc_sqrt) / (2 * a)
    t2 = (-b + disc_sqrt) / (2 * a)
    t = t1 if t1 > 0.01 else t2
    if t > 0.01:
        return t
    return MAX_RANGE + 1


def cast_rays(
    ego_x: float, ego_y: float, ego_theta: float,
    obstacles: list[tuple[float, float]],
) -> list[float]:
    """
    Cast NUM_RAYS rays from ego pose, check against walls + vehicle obstacles.
    Returns list of range readings matching Carmen FLASER format.
    """
    angles = np.linspace(ego_theta - FOV / 2, ego_theta + FOV / 2, NUM_RAYS)
    distances = []

    for angle in angles:
        dx = math.cos(angle)
        dy = math.sin(angle)
        min_dist = MAX_RANGE

        for x1, y1, x2, y2 in WALLS:
            d = ray_segment_intersection(ego_x, ego_y, dx, dy, x1, y1, x2, y2)
            if d < min_dist:
                min_dist = d

        for vx, vy in obstacles:
            d = ray_circle_intersection(ego_x, ego_y, dx, dy, vx, vy, VEHICLE_RADIUS)
            if d < min_dist:
                min_dist = d

        min_dist += np.random.normal(0, NOISE_STD)
        min_dist = float(np.clip(min_dist, 0.0, MAX_RANGE))
        distances.append(round(min_dist, 2))

    return distances


def run_simulation(sumocfg: str, output_path: str, use_gui: bool = False) -> None:
    sumo_bin = "sumo-gui" if use_gui else "sumo"
    traci.start([sumo_bin, "-c", sumocfg, "--step-length", "0.1"])

    ego_id = "ego_0"
    scans: list[dict] = []
    step = 0
    sim_time_base = 976052857.0  # match intel.log.txt epoch style

    print("Waiting for ego vehicle to depart...")

    try:
        while traci.simulation.getMinExpectedNumber() > 0:
            traci.simulationStep()
            step += 1

            vehicle_ids = traci.vehicle.getIDList()
            if ego_id not in vehicle_ids:
                continue

            ego_pos = traci.vehicle.getPosition(ego_id)
            ego_angle_deg = traci.vehicle.getAngle(ego_id)
            # SUMO angle: 0=north, clockwise. Convert to math angle: 0=east, counter-clockwise.
            ego_theta = math.radians(90.0 - ego_angle_deg)
            ego_x, ego_y = ego_pos

            obstacles = []
            for vid in vehicle_ids:
                if vid == ego_id:
                    continue
                vpos = traci.vehicle.getPosition(vid)
                obstacles.append(vpos)

            ranges = cast_rays(ego_x, ego_y, ego_theta, obstacles)
            timestamp = sim_time_base + step * 0.1

            scans.append({
                "ego_pose": (ego_x, ego_y, ego_theta),
                "ranges": ranges,
                "timestamp": timestamp,
            })

            if len(scans) % 100 == 0:
                print(f"  collected {len(scans)} scans...")

    finally:
        traci.close()

    n = write_carmen_log(output_path, scans)
    print(f"Done: {n} scans written to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="SUMO LiDAR simulation -> Carmen log")
    parser.add_argument("--gui", action="store_true", help="Launch SUMO GUI")
    parser.add_argument(
        "--config",
        default=os.path.join(os.path.dirname(__file__), "simulation.sumocfg"),
        help="Path to .sumocfg file",
    )
    parser.add_argument(
        "--output",
        default=os.path.join(os.path.dirname(__file__), "output", "carmen_sumo.log"),
        help="Output Carmen log path",
    )
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    run_simulation(args.config, args.output, args.gui)


if __name__ == "__main__":
    main()
