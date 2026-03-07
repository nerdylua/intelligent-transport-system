import random
import itertools
from uxsim import World


def create_network(
    seed: int | None = None,
    tmax: int = 3600,
    signal_phases: tuple[int, int] = (60, 60),
    demand_mean: float = 0.22,
    print_mode: int = 1,
    save_mode: int = 1,
    name: str = "its_intersection",
) -> World:
    W = World(
        name=name,
        deltan=5,
        tmax=tmax,
        print_mode=print_mode,
        save_mode=save_mode,
        show_mode=1,
        random_seed=seed,
        duo_update_time=600,
    )
    random.seed(seed)

    I1 = W.addNode("I1", 0, 0, signal=list(signal_phases))
    I2 = W.addNode("I2", 1, 0, signal=list(signal_phases))
    I3 = W.addNode("I3", 0, -1, signal=list(signal_phases))
    I4 = W.addNode("I4", 1, -1, signal=list(signal_phases))
    W1 = W.addNode("W1", -1, 0)
    W2 = W.addNode("W2", -1, -1)
    E1 = W.addNode("E1", 2, 0)
    E2 = W.addNode("E2", 2, -1)
    N1 = W.addNode("N1", 0, 1)
    N2 = W.addNode("N2", 1, 1)
    S1 = W.addNode("S1", 0, -2)
    S2 = W.addNode("S2", 1, -2)

    link_params = dict(length=500, free_flow_speed=10, jam_density=0.2)

    for n1, n2 in [[W1, I1], [I1, I2], [I2, E1], [W2, I3], [I3, I4], [I4, E2]]:
        W.addLink(n1.name + n2.name, n1, n2, signal_group=0, **link_params)
        W.addLink(n2.name + n1.name, n2, n1, signal_group=0, **link_params)

    for n1, n2 in [[N1, I1], [I1, I3], [I3, S1], [N2, I2], [I2, I4], [I4, S2]]:
        W.addLink(n1.name + n2.name, n1, n2, signal_group=1, **link_params)
        W.addLink(n2.name + n1.name, n2, n1, signal_group=1, **link_params)

    boundary = [W1, W2, E1, E2, N1, N2, S1, S2]
    dt = 30
    for n1, n2 in itertools.permutations(boundary, 2):
        for t in range(0, tmax, dt):
            W.adddemand(n1, n2, t, t + dt, random.uniform(0, demand_mean))

    return W
