"""Build one site's data files from its DEM and the SPICE kernels."""

import json
from pathlib import Path

from lunarnav.dem import load_dem_crop
from lunarnav.ephemeris import compute_ephemeris
from lunarnav.export import write_site
from lunarnav.horizon import compute_horizon


def update_index(out_root: Path, site: dict) -> None:
    """Insert or replace ``{id, name}`` for ``site`` in ``out_root/index.json``."""
    path = Path(out_root) / "index.json"
    index = json.loads(path.read_text()) if path.exists() else []
    entry = {"id": site["id"], "name": site["name"]}
    for i, existing in enumerate(index):
        if existing["id"] == entry["id"]:
            index[i] = entry
            break
    else:
        index.append(entry)
    path.write_text(json.dumps(index, ensure_ascii=False, indent=2))


def build_site(
    site: dict,
    dem_path: str,
    out_root: Path,
    radius_m: float = 10_000.0,
    cache_dir: Path = Path("cache"),
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
    eph = compute_ephemeris(site["lat_deg"], site["lon_deg"], cache_dir=cache_dir)
    out_dir = out_root / site["id"]
    write_site(out_dir, site, horizon, eph)
    update_index(out_root, site)
    return out_dir
