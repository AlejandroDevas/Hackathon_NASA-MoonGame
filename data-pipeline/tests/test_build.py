import json

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import from_origin

from lunarnav.build import build_site, update_index
from test_export import SITE

MOON_SOUTH_STEREO = "+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1737400 +units=m"


def write_flat_dem(path):
    n = 300  # 20 m/px, spans [-3000, 3000] m
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=n,
        width=n,
        count=1,
        dtype="float32",
        crs=CRS.from_string(MOON_SOUTH_STEREO),
        transform=from_origin(-3000, 3000, 20, 20),
    ) as dst:
        dst.write(np.zeros((n, n), dtype="float32"), 1)


def test_update_index_upserts(tmp_path):
    update_index(tmp_path, {"id": "a", "name": "A"})
    update_index(tmp_path, {"id": "b", "name": "B"})
    update_index(tmp_path, {"id": "a", "name": "A renamed"})
    index = json.loads((tmp_path / "index.json").read_text())
    assert index == [{"id": "a", "name": "A renamed"}, {"id": "b", "name": "B"}]


def test_build_site_end_to_end(tmp_path, kernels_ready):
    dem = tmp_path / "flat.tif"
    write_flat_dem(dem)
    site = {**SITE, "lat_deg": -89.95, "lon_deg": 0.0}
    out = build_site(site, str(dem), tmp_path / "sites", radius_m=500.0, cache_dir=kernels_ready)

    assert out == tmp_path / "sites" / "demo"
    assert (out / "ephemeris.bin").stat().st_size == 43_824 * 16
    horizon = json.loads((out / "horizon.json").read_text())["elevation_deg"]
    assert len(horizon) == 360 and np.isfinite(horizon).all()
    index = json.loads((tmp_path / "sites" / "index.json").read_text())
    assert index == [{"id": "demo", "name": "Demo site"}]
