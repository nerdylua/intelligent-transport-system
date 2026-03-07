from __future__ import annotations
from pathlib import Path


def parse_carmen_log(filepath: str | Path) -> list[dict]:
    scans = []
    params = {}

    with open(filepath, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            parts = line.split()
            tag = parts[0]

            if tag == "PARAM":
                if len(parts) >= 3:
                    params[parts[1]] = parts[2]

            elif tag == "FLASER":
                n = int(parts[1])
                ranges = [float(x) for x in parts[2 : 2 + n]]
                offset = 2 + n
                laser_x = float(parts[offset])
                laser_y = float(parts[offset + 1])
                laser_theta = float(parts[offset + 2])
                odom_x = float(parts[offset + 3])
                odom_y = float(parts[offset + 4])
                odom_theta = float(parts[offset + 5])
                timestamp = float(parts[offset + 6])

                scans.append({
                    "ranges": ranges,
                    "pose": (laser_x, laser_y, laser_theta),
                    "odom": (odom_x, odom_y, odom_theta),
                    "n_rays": n,
                    "timestamp": timestamp,
                })

    return scans


def scan_stats(scans: list[dict]) -> dict:
    """Return summary statistics about parsed scans."""
    if not scans:
        return {"count": 0}
    n_rays_set = set(s["n_rays"] for s in scans)
    return {
        "count": len(scans),
        "n_rays_values": sorted(n_rays_set),
        "time_range": (scans[0]["timestamp"], scans[-1]["timestamp"]),
        "pose_range_x": (
            min(s["pose"][0] for s in scans),
            max(s["pose"][0] for s in scans),
        ),
        "pose_range_y": (
            min(s["pose"][1] for s in scans),
            max(s["pose"][1] for s in scans),
        ),
    }


if __name__ == "__main__":
    import sys

    path = sys.argv[1] if len(sys.argv) > 1 else "intel.log.txt"
    scans = parse_carmen_log(path)
    stats = scan_stats(scans)
    print(f"Parsed {path}:")
    for k, v in stats.items():
        print(f"  {k}: {v}")
