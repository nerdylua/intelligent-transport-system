import json
import os

import numpy as np

OUTPUT_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "frontend", "public", "data", "kitti",
)

NUM_FRAMES = 150
FPS = 10
POINTS_PER_FRAME = 8000


def generate_trajectory():
    t = np.linspace(0, 1, NUM_FRAMES)
    total_dist = 120

    x = t * total_dist
    z = 15 * np.sin(t * np.pi * 1.3) + 5 * np.sin(t * np.pi * 3.1)
    y = np.zeros(NUM_FRAMES)

    dx = np.gradient(x)
    dz = np.gradient(z)
    yaw = np.arctan2(dx, dz)

    ds = np.sqrt(dx ** 2 + dz ** 2)
    speed = ds * FPS
    acceleration = np.gradient(speed, 1.0 / FPS)
    wheel_angle = np.gradient(yaw, 1.0 / FPS) * 0.25

    return x, y, z, yaw, speed, acceleration, wheel_angle


def generate_static_objects(rng):
    vehicles = [
        {"x": 12.0, "y": 0.75, "z": -3.0, "w": 4.5, "h": 1.5, "l": 1.8, "yaw": 0.05, "label": "Car"},
        {"x": 30.0, "y": 0.75, "z": 5.0, "w": 4.5, "h": 1.5, "l": 1.8, "yaw": -0.08, "label": "Car"},
        {"x": 52.0, "y": 0.75, "z": 10.0, "w": 4.5, "h": 1.5, "l": 1.8, "yaw": 0.12, "label": "Car"},
        {"x": 75.0, "y": 0.75, "z": 2.0, "w": 4.5, "h": 1.5, "l": 1.8, "yaw": -0.03, "label": "Car"},
        {"x": 40.0, "y": 1.0, "z": -6.0, "w": 6.0, "h": 2.5, "l": 2.2, "yaw": 0.0, "label": "Truck"},
        {"x": 95.0, "y": 0.75, "z": 8.0, "w": 4.5, "h": 1.5, "l": 1.8, "yaw": 0.1, "label": "Car"},
        {"x": 22.0, "y": 0.9, "z": 7.0, "w": 1.8, "h": 1.7, "l": 0.6, "yaw": 0.3, "label": "Cyclist"},
        {"x": 65.0, "y": 0.9, "z": -4.5, "w": 0.6, "h": 1.8, "l": 0.6, "yaw": -0.2, "label": "Pedestrian"},
    ]
    return vehicles


def generate_point_cloud(car_x, car_z, car_yaw, rng):
    parts = []

    n_road = 3500
    rx = car_x + rng.uniform(-8, 55, n_road)
    rz = car_z + rng.uniform(-7, 7, n_road)
    ry = rng.normal(0.0, 0.015, n_road)
    parts.append(np.stack([rx, ry, rz], axis=1))

    for side in [-1, 1]:
        n_wall = 800
        wx = car_x + rng.uniform(-5, 55, n_wall)
        wz = car_z + side * rng.uniform(8, 14, n_wall)
        wy = rng.uniform(0, rng.uniform(3, 7), n_wall)
        parts.append(np.stack([wx, wy, wz], axis=1))

    for i in range(8):
        tx_base = car_x + 5 + i * 7
        tz_base = car_z + rng.choice([-1, 1]) * rng.uniform(5, 9)
        n_t = 120
        tx = tx_base + rng.normal(0, 0.6, n_t)
        tz = tz_base + rng.normal(0, 0.6, n_t)
        ty = rng.uniform(1.5, 5.5, n_t)
        trunk_n = 25
        trunk_x = tx_base + rng.normal(0, 0.08, trunk_n)
        trunk_z = tz_base + rng.normal(0, 0.08, trunk_n)
        trunk_y = rng.uniform(0, 2.0, trunk_n)
        parts.append(np.stack([
            np.concatenate([tx, trunk_x]),
            np.concatenate([ty, trunk_y]),
            np.concatenate([tz, trunk_z]),
        ], axis=1))

    for off in [12, 28, 45]:
        n_c = 250
        cx = car_x + off + rng.uniform(-1.5, 1.5, n_c)
        cz = car_z + rng.uniform(-3, 1, n_c)
        cy = rng.uniform(0, 1.5, n_c)
        parts.append(np.stack([cx, cy, cz], axis=1))

    all_pts = np.concatenate(parts, axis=0).astype(np.float32)

    dists = np.sqrt((all_pts[:, 0] - car_x) ** 2 + (all_pts[:, 2] - car_z) ** 2)
    all_pts = all_pts[dists < 55]

    if len(all_pts) > POINTS_PER_FRAME:
        idx = rng.choice(len(all_pts), POINTS_PER_FRAME, replace=False)
        all_pts = all_pts[idx]
    elif len(all_pts) < POINTS_PER_FRAME:
        pad = POINTS_PER_FRAME - len(all_pts)
        far = rng.uniform(-40, 40, (pad, 3)).astype(np.float32)
        far[:, 1] = rng.uniform(0, 0.1, pad)
        all_pts = np.concatenate([all_pts, far])

    return all_pts


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    rng = np.random.default_rng(42)

    print("Generating trajectory...")
    x, y, z, yaw, speed, accel, wheel = generate_trajectory()

    print("Generating static objects...")
    vehicles = generate_static_objects(rng)

    print(f"Generating {NUM_FRAMES} point cloud frames...")
    all_points = np.zeros((NUM_FRAMES, POINTS_PER_FRAME, 3), dtype=np.float32)
    for i in range(NUM_FRAMES):
        all_points[i] = generate_point_cloud(x[i], z[i], yaw[i], rng)
        if (i + 1) % 30 == 0:
            print(f"  {i + 1}/{NUM_FRAMES}")

    frame_objects = []
    for i in range(NUM_FRAMES):
        visible = []
        for v in vehicles:
            dist = np.sqrt((v["x"] - x[i]) ** 2 + (v["z"] - z[i]) ** 2)
            if dist < 50:
                visible.append(v)
        frame_objects.append(visible)

    scene = {
        "frameCount": NUM_FRAMES,
        "fps": FPS,
        "duration": round(NUM_FRAMES / FPS, 1),
        "pointsPerFrame": POINTS_PER_FRAME,
        "trajectory": [
            {"x": round(float(x[i]), 3), "y": 0.0, "z": round(float(z[i]), 3),
             "yaw": round(float(yaw[i]), 4)}
            for i in range(NUM_FRAMES)
        ],
        "metrics": [
            {
                "speed": round(float(speed[i]), 2),
                "acceleration": round(float(accel[i]), 3),
                "wheelAngle": round(float(wheel[i]), 4),
            }
            for i in range(NUM_FRAMES)
        ],
        "objects": frame_objects,
    }

    json_path = os.path.join(OUTPUT_DIR, "scene.json")
    with open(json_path, "w") as f:
        json.dump(scene, f)

    bin_path = os.path.join(OUTPUT_DIR, "pointclouds.bin")
    all_points.reshape(-1).tofile(bin_path)

    print(f"\nDone! {NUM_FRAMES} frames generated:")
    print(f"  scene.json:      {os.path.getsize(json_path) / 1024:.1f} KB")
    print(f"  pointclouds.bin: {os.path.getsize(bin_path) / 1024 / 1024:.1f} MB")
    print(f"  Output: {os.path.abspath(OUTPUT_DIR)}")


if __name__ == "__main__":
    main()
