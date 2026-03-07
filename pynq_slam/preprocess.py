from __future__ import annotations
import numpy as np
from scipy.ndimage import gaussian_filter


MAX_RANGE = 81.0   # readings >= this are treated as "no return"
MIN_RANGE = 0.05   # filter out readings too close (sensor noise)

GRID_RESOLUTION = 0.1   # metres per cell
GRID_SIZE = 800          # cells per side (default, overridden by auto_grid)
GRID_ORIGIN = -GRID_SIZE * GRID_RESOLUTION / 2  # (default, overridden by auto_grid)
GRID_PADDING = 20.0      # metres of padding around data extent


def auto_grid(scans: list[dict], resolution: float = GRID_RESOLUTION,
              padding: float = GRID_PADDING) -> dict:
    """
    Compute grid parameters that cover the data extent with padding.
    Works with both small indoor datasets (intel.log) and large outdoor
    corridors (SUMO synthetic).
    """
    xs = [s["pose"][0] for s in scans]
    ys = [s["pose"][1] for s in scans]
    x_min, x_max = min(xs) - padding, max(xs) + padding
    y_min, y_max = min(ys) - padding, max(ys) + padding

    extent = max(x_max - x_min, y_max - y_min)
    size = int(np.ceil(extent / resolution))
    size = max(size, 200)

    origin_x = (x_min + x_max) / 2 - (size * resolution) / 2
    origin_y = (y_min + y_max) / 2 - (size * resolution) / 2

    return {
        "size": size,
        "resolution": resolution,
        "origin_x": origin_x,
        "origin_y": origin_y,
    }


def polar_to_cartesian(
    ranges: list[float] | np.ndarray,
    n_rays: int = 180,
    fov_rad: float = np.pi,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Convert polar range readings to Cartesian (x, y) in the sensor frame.
    Filters out max-range and too-close readings.

    Returns (xs, ys) arrays of valid points.
    """
    ranges = np.asarray(ranges, dtype=np.float64)
    angles = np.linspace(-fov_rad / 2, fov_rad / 2, n_rays)

    valid = (ranges > MIN_RANGE) & (ranges < MAX_RANGE)
    x = ranges[valid] * np.cos(angles[valid])
    y = ranges[valid] * np.sin(angles[valid])
    return x, y


def transform_to_world(
    local_x: np.ndarray,
    local_y: np.ndarray,
    pose_x: float,
    pose_y: float,
    pose_theta: float,
) -> tuple[np.ndarray, np.ndarray]:
    """Transform scan points from sensor frame to world frame."""
    cos_t = np.cos(pose_theta)
    sin_t = np.sin(pose_theta)
    world_x = cos_t * local_x - sin_t * local_y + pose_x
    world_y = sin_t * local_x + cos_t * local_y + pose_y
    return world_x, world_y


def world_to_grid(
    world_x: np.ndarray,
    world_y: np.ndarray,
    resolution: float = GRID_RESOLUTION,
    origin_x: float = GRID_ORIGIN,
    origin_y: float | None = None,
    grid_size: int = GRID_SIZE,
) -> tuple[np.ndarray, np.ndarray]:
    """Convert world coordinates to grid cell indices."""
    if origin_y is None:
        origin_y = origin_x
    col = ((world_x - origin_x) / resolution).astype(np.int32)
    row = ((world_y - origin_y) / resolution).astype(np.int32)
    valid = (col >= 0) & (col < grid_size) & (row >= 0) & (row < grid_size)
    return row[valid], col[valid]


def _bresenham(r0: int, c0: int, r1: int, c1: int) -> tuple[np.ndarray, np.ndarray]:
    """Bresenham's line from (r0,c0) to (r1,c1), excluding the endpoint."""
    dr = abs(r1 - r0)
    dc = abs(c1 - c0)
    sr = 1 if r1 > r0 else -1
    sc = 1 if c1 > c0 else -1
    err = dr - dc
    rows, cols = [], []
    r, c = r0, c0
    while (r, c) != (r1, c1):
        rows.append(r)
        cols.append(c)
        e2 = 2 * err
        if e2 > -dc:
            err -= dc
            r += sr
        if e2 < dr:
            err += dr
            c += sc
    return np.array(rows, dtype=np.int32), np.array(cols, dtype=np.int32)


class OccupancyGrid:
    """
    Log-odds occupancy grid that accumulates evidence from multiple scans.
    Uses Bresenham ray tracing to mark free space along each ray, and
    provides a Gaussian-smoothed likelihood field for robust CSM scoring.
    """

    def __init__(
        self,
        size: int = GRID_SIZE,
        resolution: float = GRID_RESOLUTION,
        origin_x: float = GRID_ORIGIN,
        origin_y: float | None = None,
    ):
        self.size = size
        self.resolution = resolution
        self.origin_x = origin_x
        self.origin_y = origin_y if origin_y is not None else origin_x
        self.origin = self.origin_x  # backward compat for score_candidate
        self.log_odds = np.zeros((size, size), dtype=np.float64)
        self.l_occ = 0.85   # log-odds increment for occupied
        self.l_free = -0.40  # log-odds increment for free
        self.l_max = 5.0
        self.l_min = -5.0
        self._likelihood_dirty = True

    @classmethod
    def from_scans(cls, scans: list[dict]) -> "OccupancyGrid":
        """Create an auto-sized grid that covers the given scan data."""
        params = auto_grid(scans)
        return cls(
            size=params["size"],
            resolution=params["resolution"],
            origin_x=params["origin_x"],
            origin_y=params["origin_y"],
        )

    def update(self, scan: dict) -> None:
        """
        Update grid with a single scan: mark endpoints as occupied and
        trace rays from the sensor to mark free space along the path.
        """
        local_x, local_y = polar_to_cartesian(
            scan["ranges"], scan["n_rays"]
        )
        px, py, ptheta = scan["pose"]
        world_x, world_y = transform_to_world(local_x, local_y, px, py, ptheta)

        sensor_col = int((px - self.origin_x) / self.resolution)
        sensor_row = int((py - self.origin_y) / self.resolution)

        hit_rows, hit_cols = world_to_grid(
            world_x, world_y, self.resolution, self.origin_x, self.origin_y, self.size
        )

        for hr, hc in zip(hit_rows, hit_cols):
            free_rows, free_cols = _bresenham(sensor_row, sensor_col, hr, hc)
            valid = (
                (free_rows >= 0) & (free_rows < self.size) &
                (free_cols >= 0) & (free_cols < self.size)
            )
            self.log_odds[free_rows[valid], free_cols[valid]] += self.l_free

        self.log_odds[hit_rows, hit_cols] += self.l_occ
        np.clip(self.log_odds, self.l_min, self.l_max, out=self.log_odds)
        self._likelihood_dirty = True

    def get_probability_map(self) -> np.ndarray:
        """Return occupancy probability map (0=free, 1=occupied)."""
        return 1.0 / (1.0 + np.exp(-self.log_odds))

    def get_likelihood_field(self, sigma: float = 3.0) -> np.ndarray:
        """
        Return Gaussian-smoothed probability map for CSM scoring.
        The smoothing creates a likelihood field that makes correlation
        robust to small pose errors (standard practice per the report).
        """
        if not hasattr(self, '_likelihood_cache') or self._likelihood_dirty:
            prob = self.get_probability_map()
            self._likelihood_cache = gaussian_filter(prob, sigma=sigma)
            self._likelihood_dirty = False
        return self._likelihood_cache

    def get_binary_map(self, threshold: float = 0.6) -> np.ndarray:
        """Return binary occupancy (0/1) at given probability threshold."""
        return (self.get_probability_map() > threshold).astype(np.float32)


def discretize_scan(
    local_x: np.ndarray,
    local_y: np.ndarray,
    resolution: float = GRID_RESOLUTION,
) -> np.ndarray:
    """
    Discretize scan points onto a local grid for CSM matching.
    Returns array of (row, col) pairs relative to the scan center.
    """
    cols = np.round(local_x / resolution).astype(np.int32)
    rows = np.round(local_y / resolution).astype(np.int32)
    return np.column_stack([rows, cols])


def preprocess_scan(scan: dict) -> dict:
    """
    Full preprocessing of a single scan: polar->cartesian, discretization.
    Returns enriched scan dict with 'local_xy' and 'grid_points' added.
    """
    local_x, local_y = polar_to_cartesian(scan["ranges"], scan["n_rays"])
    grid_pts = discretize_scan(local_x, local_y)
    return {
        **scan,
        "local_xy": (local_x, local_y),
        "grid_points": grid_pts,
    }


if __name__ == "__main__":
    import sys
    sys.path.insert(0, ".")
    from parse_carmen import parse_carmen_log, scan_stats

    path = sys.argv[1] if len(sys.argv) > 1 else "../intel.log.txt"
    scans = parse_carmen_log(path)
    print(f"Parsed {len(scans)} scans")

    grid = OccupancyGrid()
    for s in scans:
        grid.update(s)

    occ = grid.get_binary_map()
    print(f"Occupancy grid: {occ.shape}, occupied cells: {int(occ.sum())}")

    try:
        import matplotlib.pyplot as plt
        plt.figure(figsize=(8, 8))
        plt.imshow(occ, cmap="gray_r", origin="lower")
        plt.title(f"Occupancy Grid ({len(scans)} scans)")
        plt.colorbar(label="Occupied")
        plt.savefig("output/occupancy_preview.png", dpi=150)
        print("Preview saved to output/occupancy_preview.png")
    except Exception as e:
        print(f"Could not save preview: {e}")
