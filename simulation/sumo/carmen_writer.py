import numpy as np

CARMEN_HEADER = """\
# message_name [message contents] ipc_timestamp ipc_hostname logger_timestamp
# message formats defined: PARAM SYNC ODOM FLASER RLASER TRUEPOS
# PARAM param_name param_value
# SYNC tagname
# ODOM x y theta tv rv accel
# FLASER num_readings [range_readings] x y theta odom_x odom_y odom_theta
# RLASER num_readings [range_readings] x y theta odom_x odom_y odom_theta
# TRUEPOS true_x true_y true_theta odom_x odom_y odom_theta
PARAM robot_frontlaser_offset 0.0 nohost 0
PARAM robot_rearlaser_offset 0.0 nohost 0
"""


def write_carmen_log(output_path: str, scans: list[dict]) -> int:
    count = 0
    with open(output_path, "w") as f:
        f.write(CARMEN_HEADER)
        for scan in scans:
            x, y, theta = scan["ego_pose"]
            odom_x = x + np.random.normal(0, 0.01)
            odom_y = y + np.random.normal(0, 0.01)
            t = scan["timestamp"]
            ranges = scan["ranges"]
            n = len(ranges)
            dist_str = " ".join(f"{d:.2f}" for d in ranges)

            f.write(
                f"ODOM {odom_x:.6f} {odom_y:.6f} {theta:.6f} "
                f"0.000000 0.000000 0.000000 {t:.6f} nohost 0.000000\n"
            )
            f.write(
                f"FLASER {n} {dist_str} "
                f"{x:.6f} {y:.6f} {theta:.6f} "
                f"{odom_x:.6f} {odom_y:.6f} {theta:.6f} "
                f"{t:.6f} nohost 0.000000\n"
            )
            count += 1
    return count
