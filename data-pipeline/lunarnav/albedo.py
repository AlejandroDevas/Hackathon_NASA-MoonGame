"""Per-site LROC tone map aligned with the 3D terrain grid."""

from __future__ import annotations

import json
import urllib.request
from collections.abc import Callable
from pathlib import Path

import numpy as np

from . import lroc

#: Where the browse PNGs of the NAC south-pole mosaic live (PDS Imaging Node archive on AWS).
BROWSE_URL = (
    "https://pds.mcp.nasa.gov/data/store/img/lunar_reconnaissance_orbiter/pds4/lroc/"
    "lro-l-lroc-5-rdr/LROLRC_2001/EXTRAS/BROWSE/NAC_POLE/NAC_POLE_SOUTH"
)
ALBEDO_FILE = "albedo.bin"
#: Value that means "same as the surroundings" in the stored relative tone (1.0 -> 100).
NEUTRAL = 100
#: Radius (cells) of the box blur that estimates the local mean brightness: 20 cells = 100 m at 5 m/px.
BLUR_RADIUS = 20
#: A pixel is "sunlit" in the source image above this share of the 95th-percentile brightness.
LIT_FRACTION = 0.12
#: Relative tones are limited to this range around 1.0.
REL_MIN, REL_MAX = 0.5, 1.8
#: Below this share of the terrain covered by the mosaic, the tone map is not worth shipping.
MIN_COVERAGE = 0.6


def terrain_grid_xy(site: dict, terrain: dict) -> tuple[np.ndarray, np.ndarray]:
    """South-polar-stereographic (x, y) in metres of every cell centre of the terrain grid.

    The terrain is a crop of a polar-stereographic DEM, so its axes are x (east of the 0 deg
    meridian) and y (towards 0 deg E): the cell (r, c) lies (c - col0) * pixel to the right of
    the site and (r - row0) * pixel below it, with (row0, col0) the site's own position.
    """
    x_site, y_site = lroc.polar_xy(site["lat_deg"], site["lon_deg"])
    rows, cols, pixel = terrain["rows"], terrain["cols"], terrain["pixel_m"]
    row0, col0 = terrain["observer_rc"]
    c = np.arange(cols, dtype=float)
    r = np.arange(rows, dtype=float)
    x = x_site + (c[None, :] - col0) * pixel
    y = y_site - (r[:, None] - row0) * pixel
    return np.broadcast_to(x, (rows, cols)).copy(), np.broadcast_to(y, (rows, cols)).copy()


def tiles_for_site(site: dict, terrain: dict) -> list[str]:
    x, y = terrain_grid_xy(site, terrain)
    return lroc.tiles_needed(x, y)


def download_tile(name: str, cache_dir: Path) -> Path:
    """Fetch one browse PNG (a few hundred KB) into `cache_dir`, unless it is already there."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    target = cache_dir / f"{name}.BROWSE.PNG"
    if not target.exists():
        request = urllib.request.Request(
            f"{BROWSE_URL}/{name}.BROWSE.PNG", headers={"User-Agent": "lunar-landing-site-navigator"}
        )
        with urllib.request.urlopen(request, timeout=120) as response:
            target.write_bytes(response.read())
    return target


def png_loader(cache_dir: Path) -> Callable[[str], np.ndarray | None]:
    """A tile loader for lroc.sample_tones that reads the cached browse PNGs as 8-bit grey."""
    from PIL import Image

    Image.MAX_IMAGE_PIXELS = None

    def load(name: str) -> np.ndarray | None:
        path = cache_dir / f"{name}.BROWSE.PNG"
        if not path.exists():
            return None
        with Image.open(path) as image:
            return np.asarray(image.convert("L"))

    return load


def _box_blur(image: np.ndarray, radius: int) -> np.ndarray:
    """Mean over a (2 radius + 1) square window, via cumulative sums along each axis (edges use the part inside)."""
    out = image.astype(float)
    for axis in (0, 1):
        out = np.moveaxis(out, axis, 0)
        n = out.shape[0]
        csum = np.concatenate([np.zeros((1,) + out.shape[1:]), np.cumsum(out, axis=0)])
        hi = np.minimum(np.arange(n) + radius + 1, n)
        lo = np.maximum(np.arange(n) - radius, 0)
        counts = (hi - lo).reshape((-1,) + (1,) * (out.ndim - 1))
        out = np.moveaxis((csum[hi] - csum[lo]) / counts, 0, axis)
    return out


def relative_tone(tones: np.ndarray) -> np.ndarray:
    """Local contrast of the sunlit parts of a tone map, as uint8 with NEUTRAL = 1.0 and 0 = no information.

    The mosaic was shot at the 2010 solstice with the Sun almost on the horizon, so most of it is
    shadow and the rest carries that day's lighting. The app lights the terrain itself, on any
    date, so what is useful is not the brightness but the tonal variation (small craters, bright
    ejecta): each sunlit pixel is divided by the mean of its sunlit surroundings, and shadow and
    missing data become 0, meaning "leave the terrain colour alone".
    """
    valid = np.isfinite(tones)
    if not valid.any():
        return np.zeros(tones.shape, dtype=np.uint8)
    filled = np.where(valid, tones, 0.0)
    lit = valid & (filled >= max(4.0, LIT_FRACTION * np.percentile(filled[valid], 95)))
    weight = lit.astype(float)
    local_sum = _box_blur(np.where(lit, filled, 0.0), BLUR_RADIUS)
    local_weight = _box_blur(weight, BLUR_RADIUS)
    with np.errstate(divide="ignore", invalid="ignore"):
        mean = np.where(local_weight > 1e-6, local_sum / local_weight, np.nan)
        rel = filled / mean
    rel = np.clip(rel, REL_MIN, REL_MAX)
    out = np.zeros(tones.shape, dtype=np.uint8)
    keep = lit & np.isfinite(rel)
    out[keep] = np.clip(np.rint(rel[keep] * NEUTRAL), 1, 255).astype(np.uint8)
    return out


def build_albedo(site: dict, terrain: dict, load_tile: Callable[[str], np.ndarray | None]) -> tuple[np.ndarray, float]:
    """(uint8 relative tone map, share of the cells that are covered by the mosaic at all)."""
    x, y = terrain_grid_xy(site, terrain)
    tones = lroc.sample_tones(x, y, load_tile)
    return relative_tone(tones), float(np.isfinite(tones).mean())


def write_albedo(site_dir: Path, tones: np.ndarray, coverage: float, tiles: list[str]) -> None:
    """Write albedo.bin and record it in the site's info.json (rows x cols uint8, row-major like terrain.bin)."""
    (site_dir / ALBEDO_FILE).write_bytes(tones.tobytes())
    info_path = site_dir / "info.json"
    info = json.loads(info_path.read_text(encoding="utf-8"))
    info["albedo"] = {
        "file": ALBEDO_FILE,
        "rows": int(tones.shape[0]),
        "cols": int(tones.shape[1]),
        "coverage": round(coverage, 3),
        "source": "LROC NAC south-pole mosaic (Wagner et al. 2015), browse tiles, relative local tone of the sunlit parts",
        "neutral": NEUTRAL,
        "tiles": tiles,
    }
    info_path.write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
