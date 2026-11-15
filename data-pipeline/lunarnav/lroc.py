"""Geometry of the LROC NAC south-pole mosaic and sampling of its browse tiles.

The mosaic (Wagner et al. 2015) is 40 polar-stereographic tiles at 1 m/px, projected on the
Moon sphere (R = 1,737,400 m) with the south pole at the origin and +y along 0 deg E:
x = rho sin(lon), y = rho cos(lon), rho = 2 R tan(colatitude / 2). The tiles lie in four
latitude bands counted from the pole; each tile is the bounding box of an annular sector:

    band  colatitude     tiles
    1     0.0 - 1.5 deg    4   (90 deg sectors)
    2     1.5 - 2.5 deg    8   (45 deg sectors)
    3     2.5 - 3.5 deg   12   (30 deg sectors)
    4     3.5 - 4.5 deg   16   (22.5 deg sectors)

so a tile's name and extent follow from its band and sector. The 1 m/px images are 2-3 GB
each; this module works with the small BROWSE PNGs, which cover the same extent at a coarser
scale, so that the image scale is taken from the PNG's own size.
"""

from __future__ import annotations

import math
from collections.abc import Callable

import numpy as np

R_MOON_M = 1_737_400.0
#: (colatitude from, colatitude to, number of tiles) for each band
BANDS = ((0.0, 1.5, 4), (1.5, 2.5, 8), (2.5, 3.5, 12), (3.5, 4.5, 16))
MAX_COLAT_DEG = BANDS[-1][1]
TILE_PREFIX = "NAC_POLE_"


def polar_xy(lat_deg: float, lon_deg: float) -> tuple[float, float]:
    """South polar stereographic (x, y) in metres of a latitude (negative) and east longitude."""
    colat = math.radians(90.0 + lat_deg)
    rho = 2.0 * R_MOON_M * math.tan(colat / 2.0)
    lon = math.radians(lon_deg)
    return rho * math.sin(lon), rho * math.cos(lon)


def polar_inverse(x: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Colatitude from the south pole (degrees) and east longitude in [0, 360) of (x, y) metres."""
    rho = np.hypot(x, y)
    colat = np.degrees(2.0 * np.arctan(rho / (2.0 * R_MOON_M)))
    lon = np.degrees(np.arctan2(x, y)) % 360.0
    return colat, lon


def _rho(colat_deg: float) -> float:
    return 2.0 * R_MOON_M * math.tan(math.radians(colat_deg) / 2.0)


def tile_for(colat_deg: np.ndarray, lon_deg: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """(band index, sector index) of each point; band -1 where it is outside the mosaic."""
    colat = np.asarray(colat_deg, dtype=float)
    lon = np.asarray(lon_deg, dtype=float) % 360.0
    band = np.full(colat.shape, -1, dtype=int)
    sector = np.zeros(colat.shape, dtype=int)
    for index, (lo, hi, count) in enumerate(BANDS):
        inside = (colat >= lo) & (colat < hi)
        band[inside] = index
        sector[inside] = np.minimum((lon[inside] // (360.0 / count)).astype(int), count - 1)
    return band, sector


def tile_name(band: int, sector: int) -> str:
    """The mosaic's name for a tile, e.g. NAC_POLE_P892S2250 (centre latitude and longitude in 1/10 deg)."""
    lo, hi, count = BANDS[band]
    lat = 90.0 - (lo + hi) / 2.0
    lon = (sector + 0.5) * 360.0 / count
    return f"{TILE_PREFIX}P{int(lat * 10):03d}S{int(lon * 10):04d}"


def parse_tile_name(name: str) -> tuple[int, int]:
    """Inverse of tile_name: (band, sector)."""
    digits = name.removeprefix(TILE_PREFIX)
    lat = int(digits[1:4]) / 10.0
    lon = int(digits[5:9]) / 10.0
    colat = 90.0 - lat
    for index, (lo, hi, count) in enumerate(BANDS):
        if lo <= colat <= hi:
            return index, min(int(lon // (360.0 / count)), count - 1)
    raise ValueError(f"not a NAC south-pole tile name: {name}")


def tile_bounds(band: int, sector: int) -> tuple[float, float, float, float]:
    """(xmin, ymin, xmax, ymax) in metres: the bounding box of the tile's annular sector."""
    lo, hi, count = BANDS[band]
    width = 360.0 / count
    lon_lo, lon_hi = sector * width, (sector + 1) * width
    rho_in, rho_out = _rho(lo), _rho(hi)
    angles = [lon_lo, lon_hi] + [a for a in (0.0, 90.0, 180.0, 270.0, 360.0) if lon_lo < a < lon_hi]
    points = []
    for rho in (rho_in, rho_out):
        for angle in angles:
            a = math.radians(angle)
            points.append((rho * math.sin(a), rho * math.cos(a)))
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def tiles_needed(x: np.ndarray, y: np.ndarray) -> list[str]:
    """Names of the tiles that contain at least one of the points (x, y) metres; outside points are ignored."""
    colat, lon = polar_inverse(np.asarray(x, dtype=float), np.asarray(y, dtype=float))
    band, sector = tile_for(colat, lon)
    found = {(int(b), int(s)) for b, s in zip(band.ravel(), sector.ravel()) if b >= 0}
    return sorted(tile_name(b, s) for b, s in found)


def _bilinear(image: np.ndarray, u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Bilinear sample of `image` (rows x cols) at pixel coordinates (u = column, v = row)."""
    rows, cols = image.shape
    u = np.clip(u, 0, cols - 1)
    v = np.clip(v, 0, rows - 1)
    u0 = np.floor(u).astype(int)
    v0 = np.floor(v).astype(int)
    u1 = np.minimum(u0 + 1, cols - 1)
    v1 = np.minimum(v0 + 1, rows - 1)
    fu = u - u0
    fv = v - v0
    top = image[v0, u0] * (1 - fu) + image[v0, u1] * fu
    bottom = image[v1, u0] * (1 - fu) + image[v1, u1] * fu
    return top * (1 - fv) + bottom * fv


def sample_tones(
    x: np.ndarray, y: np.ndarray, load_tile: Callable[[str], np.ndarray | None]
) -> np.ndarray:
    """Grey tone (0-255) of the mosaic at each (x, y) metres, NaN where there is no image.

    `load_tile(name)` returns the tile's browse image as a 2-D array (row 0 = the tile's +y edge) or
    None if it is not available. A pixel value of 0 is the mosaic's "no data" and gives NaN.
    """
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    colat, lon = polar_inverse(x, y)
    band, sector = tile_for(colat, lon)
    out = np.full(x.shape, np.nan)
    for b, s in sorted({(int(b), int(s)) for b, s in zip(band.ravel(), sector.ravel()) if b >= 0}):
        image = load_tile(tile_name(b, s))
        if image is None:
            continue
        xmin, ymin, xmax, ymax = tile_bounds(b, s)
        rows, cols = image.shape
        mine = (band == b) & (sector == s)
        u = (x[mine] - xmin) / (xmax - xmin) * cols - 0.5
        v = (ymax - y[mine]) / (ymax - ymin) * rows - 0.5
        tone = _bilinear(image.astype(float), u, v)
        nearest = image[np.clip(np.round(v).astype(int), 0, rows - 1), np.clip(np.round(u).astype(int), 0, cols - 1)]
        tone[nearest == 0] = np.nan
        out[mine] = tone
    return out
