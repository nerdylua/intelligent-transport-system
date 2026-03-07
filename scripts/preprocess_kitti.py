import argparse
import json
import math
import os
import struct
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
from PIL import Image

# ──────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
KITTI_DIR = PROJECT_ROOT / "kitti datasets"
OUTPUT_BASE = PROJECT_ROOT / "frontend" / "public" / "data" / "kitti"
FPS = 10  # KITTI capture rate
EARTH_R = 6378137.0  # WGS-84 semi-major axis

SEQUENCES = {
    "0005": {
        "drive": "2011_09_26_drive_0005",
        "date": "2011_09_26",
        "label": "City",
    },
    "0093": {
        "drive": "2011_09_26_drive_0093",
        "date": "2011_09_26",
        "label": "Residential",
    },
}


# ──────────────────────────────────────────────────────────────────────
# OXTS parsing  (lat, lon, alt, roll, pitch, yaw, vn, ve, vf, vl, vu,
#                ax, ay, az, af, al, au, wx, wy, wz, ...)
# ──────────────────────────────────────────────────────────────────────
def load_oxts(oxts_dir: Path):
    """Return list of dicts with parsed oxts values."""
    data_dir = oxts_dir / "data"
    files = sorted(data_dir.glob("*.txt"))
    records = []
    for f in files:
        vals = list(map(float, f.read_text().strip().split()))
        records.append(
            {
                "lat": vals[0],
                "lon": vals[1],
                "alt": vals[2],
                "roll": vals[3],
                "pitch": vals[4],
                "yaw": vals[5],
                "vn": vals[6],
                "ve": vals[7],
                "vf": vals[8],
                "vl": vals[9],
                "vu": vals[10],
                "ax": vals[11],
                "ay": vals[12],
                "az": vals[13],
                "af": vals[14],
                "al": vals[15],
                "au": vals[16],
                "wx": vals[17],
                "wy": vals[18],
                "wz": vals[19],
            }
        )
    return records


def smooth_yaw(yaws, window=5):
    """Smooth yaw angles using moving average with unwrapping."""
    arr = np.array(yaws)
    unwrapped = np.unwrap(arr)
    kernel = np.ones(window) / window
    padded = np.pad(unwrapped, (window // 2, window // 2), mode="edge")
    smoothed = np.convolve(padded, kernel, mode="valid")[: len(arr)]
    return smoothed.tolist()


def smooth_positions(values, window=3):
    """Smooth a list of values using a moving average."""
    arr = np.array(values)
    kernel = np.ones(window) / window
    padded = np.pad(arr, (window // 2, window // 2), mode="edge")
    smoothed = np.convolve(padded, kernel, mode="valid")[: len(arr)]
    return smoothed.tolist()


def oxts_to_trajectory(records):
    """Convert GPS/IMU records to local ENU positions + metrics.

    KITTI OXTS yaw is in the ENU (East-North-Up) frame where yaw=0 → East.
    Our scene coordinate system maps longitude→x (East) and latitude→z (North).
    In Three.js, rotation.y=0 → object faces -Z, rotation.y=π/2 → faces -X.

    To make the car point in its direction of travel on-screen, we derive
    the yaw from the actual trajectory displacement in scene coordinates
    using atan2(dx, dz), which gives the Three.js rotation.y convention.
    """
    lat0 = records[0]["lat"]
    lon0 = records[0]["lon"]
    scale = math.cos(math.radians(lat0))

    # Compute raw positions in scene coordinates (x=East, z=North)
    raw_xs = []
    raw_zs = []
    for rec in records:
        mx = EARTH_R * math.radians(rec["lon"] - lon0) * scale
        mz = EARTH_R * math.radians(rec["lat"] - lat0)
        raw_xs.append(mx)
        raw_zs.append(mz)

    # Smooth positions to remove GPS jitter
    smooth_xs = smooth_positions(raw_xs, window=3)
    smooth_zs = smooth_positions(raw_zs, window=3)

    # Derive yaw from direction of travel in scene coordinates.
    # atan2(dx, dz) matches Three.js rotation.y convention where
    # yaw=0 → facing +Z and yaw increases clockwise.
    #
    # We use a wider look-ahead window (±LOOK frames) to compute
    # the travel direction. This prevents single-frame GPS noise or
    # sharp deceleration/acceleration from causing wild yaw spikes
    # (e.g. at U-turns where direction reverses in 1-2 frames).
    LOOK = 4
    n = len(smooth_xs)
    raw_yaws = []
    for i in range(n):
        lo = max(0, i - LOOK)
        hi = min(n - 1, i + LOOK)
        # If lo == hi (shouldn't happen unless n==1), fall back to neighbors
        if lo == hi:
            hi = min(n - 1, lo + 1)
        dx = smooth_xs[hi] - smooth_xs[lo]
        dz = smooth_zs[hi] - smooth_zs[lo]
        raw_yaws.append(math.atan2(dx, dz))

    smoothed_yaws = smooth_yaw(raw_yaws, window=11)

    trajectory = []
    metrics = []
    for i, rec in enumerate(records):
        yaw = smoothed_yaws[i]

        trajectory.append(
            {"x": round(smooth_xs[i], 4), "y": 0, "z": round(smooth_zs[i], 4), "yaw": round(yaw, 5)}
        )

        speed = abs(rec["vf"])
        accel = rec["af"]
        wheel_angle = rec["wz"]  # yaw rate as proxy
        metrics.append(
            {
                "speed": round(speed, 3),
                "acceleration": round(accel, 3),
                "wheelAngle": round(wheel_angle, 4),
            }
        )

    return trajectory, metrics


# ──────────────────────────────────────────────────────────────────────
# Tracklet XML parsing
# ──────────────────────────────────────────────────────────────────────
def load_tracklets(tracklet_path: Path, num_frames: int):
    """Parse tracklet_labels.xml → per-frame object lists."""
    per_frame = [[] for _ in range(num_frames)]
    if not tracklet_path.exists():
        print(f"  [WARN] No tracklet file found at {tracklet_path}")
        return per_frame

    tree = ET.parse(tracklet_path)
    root = tree.getroot()
    tracklets_elem = root.find("tracklets")
    if tracklets_elem is None:
        return per_frame

    for item in tracklets_elem.findall("item"):
        obj_type = item.findtext("objectType", "Unknown")
        h = float(item.findtext("h", "0"))
        w = float(item.findtext("w", "0"))
        l = float(item.findtext("l", "0"))
        first_frame = int(item.findtext("first_frame", "0"))

        poses_elem = item.find("poses")
        if poses_elem is None:
            continue

        for pose_idx, pose in enumerate(poses_elem.findall("item")):
            frame = first_frame + pose_idx
            if frame >= num_frames:
                break
            tx = float(pose.findtext("tx", "0"))
            ty = float(pose.findtext("ty", "0"))
            tz = float(pose.findtext("tz", "0"))
            rz = float(pose.findtext("rz", "0"))

            # KITTI tracklet coords: x=forward, y=left, z=up in velodyne frame
            # We convert to our scene coords: x=right, y=up, z=forward
            per_frame[frame].append(
                {
                    "label": obj_type,
                    "x": round(ty, 3),       # KITTI y → our x
                    "y": round(h / 2, 3),    # center vertically
                    "z": round(tx, 3),       # KITTI x → our z
                    "w": round(w, 3),
                    "h": round(h, 3),
                    "l": round(l, 3),
                    "yaw": round(-rz, 4),
                }
            )

    return per_frame


# ──────────────────────────────────────────────────────────────────────
# Velodyne point cloud processing
# ──────────────────────────────────────────────────────────────────────
def process_pointclouds(velo_dir: Path, max_points: int, output_path: Path):
    """Downsample each velodyne frame with ground segmentation.

    Saves 4 floats per point: x, y, z, class
    class: 0.0 = ground, 1.0 = low object, 2.0 = high object
    """
    data_dir = velo_dir / "data"
    files = sorted(data_dir.glob("*.bin"))
    num_frames = len(files)

    GROUND_THRESH = 0.3   # KITTI z (up) below this = ground
    LOW_OBJ = 2.0         # below this = low objects
    # Keep proportions: 30% ground, 70% above-ground
    ground_budget = max(int(max_points * 0.3), 1000)
    above_budget = max_points - ground_budget

    print(f"  Processing {num_frames} point cloud frames (max {max_points} pts, 4ch)...")

    with open(output_path, "wb") as out:
        for i, f in enumerate(files):
            pts = np.fromfile(str(f), dtype=np.float32).reshape(-1, 4)
            xyz = pts[:, :3]

            # Filter out far points (beyond useful range)
            dist = np.sqrt(xyz[:, 0] ** 2 + xyz[:, 1] ** 2)
            mask = dist < 50.0  # 50m radius
            xyz = xyz[mask]

            # Segment ground vs above-ground by KITTI z-axis (up)
            is_ground = xyz[:, 2] < GROUND_THRESH
            ground_pts = xyz[is_ground]
            above_pts = xyz[~is_ground]

            # Smart downsample: preserve both ground and above-ground
            if len(ground_pts) > ground_budget:
                idx = np.random.choice(len(ground_pts), ground_budget, replace=False)
                ground_pts = ground_pts[idx]
            if len(above_pts) > above_budget:
                idx = np.random.choice(len(above_pts), above_budget, replace=False)
                above_pts = above_pts[idx]

            # Build classification column:
            # ground=0, low_object=1, high_object=2
            ground_cls = np.zeros((len(ground_pts), 1), dtype=np.float32)
            above_cls = np.where(
                above_pts[:, 2:3] < LOW_OBJ,
                np.float32(1.0),
                np.float32(2.0),
            )

            # Combine and convert coordinates
            combined = np.vstack([ground_pts, above_pts])
            classes = np.vstack([ground_cls, above_cls])

            total = len(combined)
            # Pad if needed
            if total < max_points:
                pad_xyz = np.zeros((max_points - total, 3), dtype=np.float32)
                pad_cls = np.full((max_points - total, 1), -1.0, dtype=np.float32)
                combined = np.vstack([combined, pad_xyz])
                classes = np.vstack([classes, pad_cls])
            elif total > max_points:
                combined = combined[:max_points]
                classes = classes[:max_points]

            # KITTI coords: x=forward, y=left, z=up
            # Scene coords: x=right, y=up, z=forward
            out_pts = np.empty((max_points, 4), dtype=np.float32)
            out_pts[:, 0] = -combined[:, 1]  # x_scene = -y_kitti (right)
            out_pts[:, 1] = combined[:, 2]    # y_scene = z_kitti (up)
            out_pts[:, 2] = combined[:, 0]    # z_scene = x_kitti (forward)
            out_pts[:, 3] = classes[:, 0]     # classification

            out.write(out_pts.tobytes())

            if (i + 1) % 50 == 0 or i == num_frames - 1:
                print(f"    [{i + 1}/{num_frames}]")

    return num_frames


# ──────────────────────────────────────────────────────────────────────
# Camera video generation
# ──────────────────────────────────────────────────────────────────────
def generate_camera_video(image_dir: Path, output_path: Path, fps: int = 10):
    """Encode image_02 frames to MP4 via ffmpeg."""
    data_dir = image_dir / "data"
    files = sorted(data_dir.glob("*.png"))
    if not files:
        print("  [WARN] No camera images found")
        return False

    print(f"  Encoding {len(files)} camera frames to MP4...")

    # Use ffmpeg with image sequence input
    input_pattern = str(data_dir / "%010d.png")

    cmd = [
        "ffmpeg",
        "-y",
        "-framerate", str(fps),
        "-i", input_pattern,
        "-vf", "scale=640:360",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(output_path),
    ]

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            print(f"  [ERROR] ffmpeg failed: {result.stderr[-500:]}")
            return False
        print(f"  ✓ camera.mp4 created ({output_path.stat().st_size // 1024} KB)")
        return True
    except FileNotFoundError:
        print("  [ERROR] ffmpeg not found on PATH")
        return False
    except subprocess.TimeoutExpired:
        print("  [ERROR] ffmpeg timed out")
        return False


# ──────────────────────────────────────────────────────────────────────
# Main processing
# ──────────────────────────────────────────────────────────────────────
def find_tracklet_file(tracklet_dir: Path) -> Path:
    """Find tracklet_labels.xml, handling nested structures."""
    direct = tracklet_dir / "tracklet_labels.xml"
    if direct.exists():
        return direct

    # Search recursively for the file
    for p in tracklet_dir.rglob("tracklet_labels.xml"):
        return p

    return direct  # return the expected path even if missing


def process_sequence(seq_id: str, max_points: int):
    """Process a single KITTI sequence."""
    if seq_id not in SEQUENCES:
        print(f"Unknown sequence: {seq_id}")
        return False

    cfg = SEQUENCES[seq_id]
    drive = cfg["drive"]
    base_dir = KITTI_DIR / drive

    if not base_dir.exists():
        print(f"  [ERROR] Directory not found: {base_dir}")
        return False

    sync_dir = base_dir / f"{drive}_sync"
    calib_dir = base_dir / f"{drive}_calib"
    tracklet_dir = base_dir / f"{drive}_tracklets"

    print(f"\n{'='*60}")
    print(f"Processing: {drive} ({cfg['label']})")
    print(f"{'='*60}")

    # ── Output dir ──
    out_dir = OUTPUT_BASE / drive
    out_dir.mkdir(parents=True, exist_ok=True)

    # ── 1. OXTS / Trajectory ──
    print("\n[1/4] Loading GPS/IMU data...")
    oxts_records = load_oxts(sync_dir / "oxts")
    num_frames = len(oxts_records)
    trajectory, metrics_list = oxts_to_trajectory(oxts_records)
    print(f"  ✓ {num_frames} frames, duration: {num_frames / FPS:.1f}s")

    # ── 2. Tracklets ──
    print("\n[2/4] Parsing tracklet labels...")
    tracklet_path = find_tracklet_file(tracklet_dir)
    objects = load_tracklets(tracklet_path, num_frames)
    obj_count = sum(len(f) for f in objects)
    print(f"  ✓ {obj_count} object instances across {num_frames} frames")

    # ── 3. Point Clouds ──
    print("\n[3/4] Processing point clouds...")
    pc_path = out_dir / "pointclouds.bin"
    process_pointclouds(sync_dir / "velodyne_points", max_points, pc_path)
    pc_size = pc_path.stat().st_size / (1024 * 1024)
    print(f"  ✓ pointclouds.bin ({pc_size:.1f} MB)")

    # ── 4. Camera Video ──
    print("\n[4/4] Generating camera video...")
    cam_path = out_dir / "camera.mp4"
    cam_ok = generate_camera_video(sync_dir / "image_02", cam_path, FPS)

    # ── Write scene.json ──
    scene = {
        "sequenceId": seq_id,
        "drive": drive,
        "label": cfg["label"],
        "frameCount": num_frames,
        "fps": FPS,
        "duration": round(num_frames / FPS, 2),
        "pointsPerFrame": max_points,
        "hasCamera": cam_ok,
        "trajectory": trajectory,
        "metrics": metrics_list,
        "objects": objects,
    }

    scene_path = out_dir / "scene.json"
    with open(scene_path, "w") as f:
        json.dump(scene, f, separators=(",", ":"))

    scene_size = scene_path.stat().st_size / (1024 * 1024)
    print(f"\n  ✓ scene.json ({scene_size:.1f} MB)")

    total = pc_size + scene_size + (cam_path.stat().st_size / (1024 * 1024) if cam_ok else 0)
    print(f"\n  Total output: {total:.1f} MB → {out_dir}")
    return True


def write_manifest():
    """Write a manifest listing all available sequences for the frontend."""
    manifest = []
    for seq_id, cfg in SEQUENCES.items():
        out_dir = OUTPUT_BASE / cfg["drive"]
        scene_file = out_dir / "scene.json"
        if scene_file.exists():
            manifest.append(
                {
                    "id": seq_id,
                    "drive": cfg["drive"],
                    "label": cfg["label"],
                    "path": f"/data/kitti/{cfg['drive']}",
                }
            )

    manifest_path = OUTPUT_BASE / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\n✓ Manifest written with {len(manifest)} sequence(s) → {manifest_path}")


def main():
    parser = argparse.ArgumentParser(description="Preprocess KITTI data for visualization")
    parser.add_argument(
        "--sequence", "-s",
        choices=list(SEQUENCES.keys()),
        help="Process a single sequence (default: all)",
    )
    parser.add_argument(
        "--max-points", "-p",
        type=int,
        default=12000,
        help="Max points per frame (default: 12000)",
    )
    args = parser.parse_args()

    print("KITTI Preprocessor for AV Visualization")
    print(f"KITTI data dir: {KITTI_DIR}")
    print(f"Output dir:     {OUTPUT_BASE}")
    print(f"Points/frame:   {args.max_points}")

    OUTPUT_BASE.mkdir(parents=True, exist_ok=True)

    seqs = [args.sequence] if args.sequence else list(SEQUENCES.keys())
    success = 0
    for seq_id in seqs:
        if process_sequence(seq_id, args.max_points):
            success += 1

    if success > 0:
        write_manifest()

    print(f"\nDone! {success}/{len(seqs)} sequences processed.")


if __name__ == "__main__":
    main()
