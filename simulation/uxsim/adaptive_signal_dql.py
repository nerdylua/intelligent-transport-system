import os
import sys
import math
import random
from collections import namedtuple, deque
from itertools import count

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
import gymnasium as gym

sys.path.insert(0, os.path.dirname(__file__))
from intersection_sim import create_network

os.environ["KMP_DUPLICATE_LIB_OK"] = "True"

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")


# ── Gymnasium environment wrapping UXsim ──

class TrafficSim(gym.Env):
    """
    RL environment: 4-intersection grid.
    Action:  16 possibilities (2^4), each bit = which phase is green at each intersection.
    State:   16 values = queue count per incoming link at each intersection.
    Reward:  negative change in total queued vehicles.
    """

    def __init__(self, seed: int | None = None):
        super().__init__()
        self.seed_val = seed
        self.n_action = 2**4
        self.action_space = gym.spaces.Discrete(self.n_action)
        self.n_state = 4 * 4
        self.observation_space = gym.spaces.Box(
            low=np.zeros(self.n_state, dtype=np.float32),
            high=np.full(self.n_state, 100, dtype=np.float32),
        )
        self.reset()

    def reset(self, seed=None, options=None):
        W = create_network(
            seed=self.seed_val,
            tmax=4000,
            signal_phases=(60, 60),
            demand_mean=0.22,
            print_mode=0,
            save_mode=0,
            name="dql_training",
        )
        self.W = W
        self.I1 = W.get_node("I1")
        self.I2 = W.get_node("I2")
        self.I3 = W.get_node("I3")
        self.I4 = W.get_node("I4")
        self.intersections = [self.I1, self.I2, self.I3, self.I4]
        self.INLINKS = []
        for node in self.intersections:
            self.INLINKS.extend(list(node.inlinks.values()))

        observation = np.zeros(self.n_state, dtype=np.float32)
        self.log_state = []
        self.log_reward = []
        return observation, {}

    def _get_state(self):
        return np.array(
            [l.num_vehicles_queue for l in self.INLINKS], dtype=np.float32
        )

    def _total_queue(self):
        return float(self._get_state().sum())

    def step(self, action_index):
        step_duration = 10
        old_queue = self._total_queue()

        binstr = f"{action_index:04b}"
        for i, node in enumerate(self.intersections):
            node.signal_phase = int(binstr[3 - i])
            node.signal_t = 0

        if self.W.check_simulation_ongoing():
            self.W.exec_simulation(duration_t=step_duration)

        observation = self._get_state()
        reward = -(self._total_queue() - old_queue)
        done = not self.W.check_simulation_ongoing()

        self.log_state.append(observation)
        self.log_reward.append(reward)

        return observation, float(reward), done, False, {}


# ── DQN network ──

Transition = namedtuple("Transition", ("state", "action", "next_state", "reward"))


class ReplayMemory:
    def __init__(self, capacity: int):
        self.memory = deque([], maxlen=capacity)

    def push(self, *args):
        self.memory.append(Transition(*args))

    def sample(self, batch_size: int):
        return random.sample(self.memory, batch_size)

    def __len__(self):
        return len(self.memory)


class DQN(nn.Module):
    def __init__(self, n_obs: int, n_act: int, hidden: int = 64, layers: int = 3):
        super().__init__()
        self.layers = nn.ModuleList()
        self.layers.append(nn.Linear(n_obs, hidden))
        for _ in range(layers):
            self.layers.append(nn.Linear(hidden, hidden))
        self.output = nn.Linear(hidden, n_act)

    def forward(self, x):
        for layer in self.layers:
            x = F.relu(layer(x))
        return self.output(x)


# ── Training loop ──

def train_dql(
    num_episodes: int = 200,
    batch_size: int = 128,
    gamma: float = 0.99,
    eps_start: float = 0.9,
    eps_end: float = 0.05,
    eps_decay: int = 1000,
    tau: float = 0.005,
    lr: float = 1e-4,
    seed: int | None = None,
) -> tuple[dict, object]:
    """
    Train DQN signal controller.
    Returns (best_stats_dict, best_World_object).
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training on: {device}")

    env = TrafficSim(seed=seed)
    n_actions = env.action_space.n
    state, _ = env.reset()
    n_obs = len(state)

    policy_net = DQN(n_obs, n_actions).to(device)
    target_net = DQN(n_obs, n_actions).to(device)
    target_net.load_state_dict(policy_net.state_dict())

    optimizer = optim.AdamW(policy_net.parameters(), lr=lr, amsgrad=True)
    memory = ReplayMemory(10000)

    steps_done = 0
    log_delays = []
    best_delay = float("inf")
    best_ep = -1

    def select_action(state_tensor, greedy=False):
        nonlocal steps_done
        if greedy:
            with torch.no_grad():
                return policy_net(state_tensor).max(1)[1].view(1, 1)
        eps = eps_end + (eps_start - eps_end) * math.exp(-steps_done / eps_decay)
        steps_done += 1
        if random.random() > eps:
            with torch.no_grad():
                return policy_net(state_tensor).max(1)[1].view(1, 1)
        return torch.tensor([[env.action_space.sample()]], device=device, dtype=torch.long)

    def optimize():
        if len(memory) < batch_size:
            return
        transitions = memory.sample(batch_size)
        batch = Transition(*zip(*transitions))

        non_final_mask = torch.tensor(
            [s is not None for s in batch.next_state], device=device, dtype=torch.bool
        )
        non_final_next = torch.cat([s for s in batch.next_state if s is not None])
        state_b = torch.cat(batch.state)
        action_b = torch.cat(batch.action)
        reward_b = torch.cat(batch.reward)

        q_values = policy_net(state_b).gather(1, action_b)
        next_values = torch.zeros(batch_size, device=device)
        with torch.no_grad():
            next_values[non_final_mask] = target_net(non_final_next).max(1)[0]
        expected = (next_values * gamma) + reward_b

        loss = F.smooth_l1_loss(q_values, expected.unsqueeze(1))
        optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_value_(policy_net.parameters(), 100)
        optimizer.step()

    # ── Training ──
    for ep in range(num_episodes):
        state, _ = env.reset()
        state = torch.tensor(state, dtype=torch.float32, device=device).unsqueeze(0)

        for t in count():
            action = select_action(state)
            obs, reward, done, _, _ = env.step(action.item())
            reward_t = torch.tensor([reward], device=device)

            next_state = (
                None if done
                else torch.tensor(obs, dtype=torch.float32, device=device).unsqueeze(0)
            )
            memory.push(state, action, next_state, reward_t)
            state = next_state
            optimize()

            target_sd = target_net.state_dict()
            policy_sd = policy_net.state_dict()
            for key in policy_sd:
                target_sd[key] = policy_sd[key] * tau + target_sd[key] * (1 - tau)
            target_net.load_state_dict(target_sd)

            if done:
                delay = env.W.analyzer.average_delay
                log_delays.append(delay)
                marker = ""
                if delay < best_delay:
                    best_delay = delay
                    best_ep = ep
                    marker = " ** best **"
                if ep % 5 == 0 or ep == num_episodes - 1:
                    print(f"  ep {ep:3d}: delay={delay:.1f}s{marker}")
                break

    # ── Training curve ──
    plt.figure(figsize=(8, 4))
    plt.plot(log_delays, "b.", alpha=0.4, markersize=3)
    window = min(20, len(log_delays))
    if len(log_delays) >= window:
        moving_avg = np.convolve(log_delays, np.ones(window) / window, mode="valid")
        plt.plot(range(window - 1, len(log_delays)), moving_avg, "r-", linewidth=2, label=f"{window}-ep moving avg")
    plt.xlabel("Episode")
    plt.ylabel("Average Delay (s)")
    plt.title("DQL Training Progress")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, "training_curve.png"), dpi=150)
    plt.close()

    # ── Replay one greedy episode with the trained policy for stats + animation ──
    print("\n  Replaying greedy episode with trained model...")
    env_replay = TrafficSim(seed=seed)
    env_replay.reset()
    env_replay.W.save_mode = 1
    env_replay.W.show_mode = 1
    state_r, _ = env_replay.reset()
    env_replay.W.save_mode = 1
    state_r = torch.tensor(state_r, dtype=torch.float32, device=device).unsqueeze(0)
    for t in count():
        action = select_action(state_r, greedy=True)
        obs, reward, done, _, _ = env_replay.step(action.item())
        if done:
            break
        state_r = torch.tensor(obs, dtype=torch.float32, device=device).unsqueeze(0)

    replay_W = env_replay.W
    att = replay_W.analyzer.average_travel_time
    delay_ratio = replay_W.analyzer.average_delay / att if att > 0 else 0.0
    stats = {
        "mode": "adaptive_dql",
        "avg_speed_mps": round(replay_W.analyzer.average_speed, 2),
        "avg_travel_time_s": round(att, 2),
        "avg_delay_s": round(replay_W.analyzer.average_delay, 2),
        "delay_ratio": round(delay_ratio, 3),
        "trips_completed": replay_W.analyzer.trip_completed,
        "trips_total": replay_W.analyzer.trip_all,
        "best_training_episode": best_ep,
        "best_training_delay": round(best_delay, 2),
    }
    return stats, replay_W


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 60)
    print("Training DQL adaptive signal controller...")
    print("=" * 60)
    stats, replay_W = train_dql(num_episodes=50, seed=None)
    print(f"\nBest training episode: {stats['best_training_episode']}")
    print(f"Best training delay: {stats['best_training_delay']}s")
    print(f"Greedy replay delay: {stats['avg_delay_s']}s (vs ~400s+ with fixed timing)")

    print("\nGenerating greedy replay animation...")
    replay_W.save_mode = 1
    replay_W.analyzer.network_anim(
        detailed=1,
        network_font_size=0,
        figsize=(6, 6),
        file_name=os.path.join(OUTPUT_DIR, "adaptive_anim.gif"),
    )
    print(f"Animation saved to {OUTPUT_DIR}/adaptive_anim.gif")

    # Combine with fixed metrics if available
    fixed_csv = os.path.join(OUTPUT_DIR, "fixed_metrics.csv")
    rows = []
    if os.path.exists(fixed_csv):
        rows.append(pd.read_csv(fixed_csv).iloc[0].to_dict())
    rows.append(stats)

    df = pd.DataFrame(rows)
    csv_path = os.path.join(OUTPUT_DIR, "metrics.csv")
    df.to_csv(csv_path, index=False)
    print(f"Combined metrics saved to {csv_path}")
    print("\n" + df.to_string(index=False))


if __name__ == "__main__":
    main()
