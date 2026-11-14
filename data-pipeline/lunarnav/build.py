"""Build one site's data files from its DEM and the SPICE kernels."""

import json
from pathlib import Path

import numpy as np

from lunarnav.dem import load_dem_crop
from lunarnav.ephemeris import compute_ephemeris
from lunarnav.export import write_site
from lunarnav.horizon import compute_horizon, ground_height_at
from lunarnav.terrain import write_terrain


def update_index(out_root: Path, site: dict) -> None:
    """Insert or replace ``{id, name}`` for ``site`` in ``out_root/index.json``."""
    path = Path(out_root) / "index.json"
    index = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    entry = {"id": site["id"], "name": site["name"]}
    for i, existing in enumerate(index):
        if existing["id"] == entry["id"]:
            index[i] = entry
            break
    else:
        index.append(entry)
    path.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")


def build_site(
    site: dict,
    dem_path: str,
    out_root: Path,
    radius_m: float = 10_000.0,
    cache_dir: Path = Path("cache"),
    terrain_radius_m: float = 2_500.0,
    far_dem_path: str | None = None,
    far_radius_m: float = 300_000.0,
    far_start_distance_m: float | None = None,
) -> Path:
    out_root = Path(out_root)
    crop = load_dem_crop(dem_path, site["lat_deg"], site["lon_deg"], radius_m)
    horizon = compute_horizon(
        crop.heights,
        crop.pixel_m,
        crop.observer_rc,
        crop.north_bearing_deg,
        site["observer_height_m"],
    )
    horizon_info = None
    if far_dem_path is not None:
        start_distance_m = radius_m * 0.75 if far_start_distance_m is None else far_start_distance_m
        far_crop = load_dem_crop(
            far_dem_path,
            site["lat_deg"],
            site["lon_deg"],
            far_radius_m,
            dtype="float32",
        )
        far_horizon = compute_horizon(
            far_crop.heights,
            far_crop.pixel_m,
            far_crop.observer_rc,
            far_crop.north_bearing_deg,
            site["observer_height_m"],
            min_distance_m=start_distance_m,
            observer_ground_m=ground_height_at(crop.heights, crop.observer_rc),
        )
        horizon = np.maximum(horizon, far_horizon)
        horizon_info = {
            "sources": [
                {
                    "file": Path(dem_path).name,
                    "pixel_m": crop.pixel_m,
                    "requested_range_m": [0, radius_m],
                },
                {
                    "file": Path(far_dem_path).name,
                    "pixel_m": far_crop.pixel_m,
                    "requested_range_m": [start_distance_m, far_radius_m],
                },
            ]
        }
    eph = compute_ephemeris(site["lat_deg"], site["lon_deg"], cache_dir=cache_dir)
    out_dir = out_root / site["id"]
    terrain_crop = load_dem_crop(dem_path, site["lat_deg"], site["lon_deg"], terrain_radius_m)
    terrain_block = write_terrain(out_dir, terrain_crop)
    write_site(
        out_dir, site, horizon, eph, terrain=terrain_block, horizon_info=horizon_info
    )
    update_index(out_root, site)
    return out_dir
