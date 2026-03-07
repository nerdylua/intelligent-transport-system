import os
import sys
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
from intersection_sim import create_network

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")


def run_fixed_signal(seed: int = 42) -> dict:
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    W = create_network(
        seed=seed,
        tmax=3600,
        signal_phases=(60, 60),
        demand_mean=0.22,
        print_mode=1,
        save_mode=1,
        name="fixed_signal",
    )

    W.exec_simulation()
    W.analyzer.print_simple_stats()

    print("Generating network animation (this takes a moment)...")
    W.analyzer.network_anim(
        detailed=1,
        network_font_size=0,
        figsize=(6, 6),
        file_name=os.path.join(OUTPUT_DIR, "fixed_anim.gif"),
    )
    print(f"Animation saved to {OUTPUT_DIR}/fixed_anim.gif")

    att = W.analyzer.average_travel_time
    delay_ratio = W.analyzer.average_delay / att if att > 0 else 0.0
    stats = {
        "mode": "fixed",
        "avg_speed_mps": round(W.analyzer.average_speed, 2),
        "avg_travel_time_s": round(att, 2),
        "avg_delay_s": round(W.analyzer.average_delay, 2),
        "delay_ratio": round(delay_ratio, 3),
        "trips_completed": W.analyzer.trip_completed,
        "trips_total": W.analyzer.trip_all,
    }
    print(f"\nFixed signal results: {stats}")
    return stats


if __name__ == "__main__":
    stats = run_fixed_signal()
    df = pd.DataFrame([stats])
    csv_path = os.path.join(OUTPUT_DIR, "fixed_metrics.csv")
    df.to_csv(csv_path, index=False)
    print(f"Metrics saved to {csv_path}")
