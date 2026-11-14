"""Horizon profile of a lunar site from a DEM (no atmosphere: terrain + curvature)."""

import numpy as np

MOON_RADIUS_M: float = 1_737_400.0


def _bilinear(dem: np.ndarray, r: np.ndarray, c: np.ndarray) -> np.ndarray:
    """Bilinear sample of ``dem`` at fractional (row, col); NaN outside the DEM
    or when any of the four neighbours is NaN."""
    rows, cols = dem.shape
    inside = (r >= 0) & (r <= rows - 1) & (c >= 0) & (c <= cols - 1)
    rc = np.clip(r, 0, rows - 1)
    cc = np.clip(c, 0, cols - 1)
    r_lo = np.minimum(np.floor(rc).astype(int), rows - 2)
    c_lo = np.minimum(np.floor(cc).astype(int), cols - 2)
    fr = rc - r_lo
    fc = cc - c_lo
    v = (
        dem[r_lo, c_lo] * (1 - fr) * (1 - fc)
        + dem[r_lo, c_lo + 1] * (1 - fr) * fc
        + dem[r_lo + 1, c_lo] * fr * (1 - fc)
        + dem[r_lo + 1, c_lo + 1] * fr * fc
    )
    return np.where(inside, v, np.nan)


def _observer_ground(dem: np.ndarray, r0: float, c0: float) -> float:
    ground = _bilinear(dem, np.array([r0]), np.array([c0]))[0]
    if np.isfinite(ground):
        return float(ground)
    ri, ci = int(round(r0)), int(round(c0))
    window = dem[max(ri - 5, 0) : ri + 6, max(ci - 5, 0) : ci + 6]
    return float(np.nanmedian(window)) if np.isfinite(window).any() else 0.0


def compute_horizon(
    dem: np.ndarray,
    pixel_m: float,
    observer_rc: tuple[float, float],
    north_bearing_deg: float,
    observer_height_m: float = 2.0,
) -> np.ndarray:
    """Maximum elevation angle of the terrain for each of 360 azimuths (degrees).

    ``dem[r, c]`` has x = +c, y = -r (north-up raster), heights in metres.
    Azimuth 0 = true north, 90 = east, clockwise. ``north_bearing_deg`` is the
    bearing of true north, clockwise from grid "up".
    """
    radius = MOON_RADIUS_M
    rows, cols = dem.shape
    r0, c0 = observer_rc
    h0 = _observer_ground(dem, r0, c0) + observer_height_m
    dip = -float(np.degrees(np.arccos(radius / (radius + observer_height_m))))

    max_dist = float(np.hypot(rows, cols)) * pixel_m
    dist = pixel_m * np.arange(1, int(max_dist / pixel_m) + 1)
    grid_bearing = np.radians(np.arange(360) + north_bearing_deg)
    r = r0 - np.cos(grid_bearing)[:, None] * dist[None, :] / pixel_m
    c = c0 + np.sin(grid_bearing)[:, None] * dist[None, :] / pixel_m
    heights = _bilinear(dem, r, c)

    theta = dist / radius
    elevation = np.degrees(
        np.arctan2(
            (radius + heights) * np.cos(theta) - (radius + h0),
            (radius + heights) * np.sin(theta),
        )
    )
    elevation = np.where(np.isfinite(elevation), elevation, -np.inf)
    best = elevation.max(axis=1)
    return np.where(np.isfinite(best), best, dip)
