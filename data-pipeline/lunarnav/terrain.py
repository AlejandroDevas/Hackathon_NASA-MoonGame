"""Export a DEM crop as the 16-bit height map the 3D scene loads."""

from pathlib import Path

import numpy as np

from lunarnav.dem import DemCrop


def encode_terrain(heights: np.ndarray) -> tuple[np.ndarray, float, float]:
    """Normalise ``heights`` (metres) to uint16 between its min and max; NaN -> min."""
    finite = np.isfinite(heights)
    if not finite.any():
        raise ValueError("terrain has no finite heights")
    min_m = float(heights[finite].min())
    max_m = float(heights[finite].max())
    span = (max_m - min_m) or 1.0
    filled = np.where(finite, heights, min_m)
    encoded = np.rint((filled - min_m) / span * 65535).astype(np.uint16)
    return encoded, min_m, max_m


def write_terrain(out_dir: Path, crop: DemCrop) -> dict:
    """Write ``terrain.bin`` (uint16 LE, row-major) and return the ``info.terrain`` block."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    encoded, min_m, max_m = encode_terrain(crop.heights)
    encoded.astype("<u2").tofile(out_dir / "terrain.bin")
    rows, cols = crop.heights.shape
    return {
        "file": "terrain.bin",
        "rows": int(rows),
        "cols": int(cols),
        "pixel_m": float(crop.pixel_m),
        "min_m": min_m,
        "max_m": max_m,
        "observer_rc": [float(crop.observer_rc[0]), float(crop.observer_rc[1])],
        "north_bearing_deg": float(crop.north_bearing_deg),
    }
