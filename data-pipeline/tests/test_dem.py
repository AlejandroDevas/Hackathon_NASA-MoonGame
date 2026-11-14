import numpy as np
import pytest
import rasterio
from pyproj import CRS, Transformer
from rasterio.crs import CRS as RioCRS
from rasterio.transform import from_origin

from lunarnav.dem import load_dem_crop

MOON_SOUTH_STEREO = "+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1737400 +units=m"
PIXEL_M = 20.0
HALF_EXTENT_M = 6000.0  # raster spans x, y in [-6000, 6000] (site stays >50 px from the edges)
NODATA = -9999.0


def project(lat, lon):
    crs = CRS.from_string(MOON_SOUTH_STEREO)
    return Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True).transform(lon, lat)


def pixel_of(lat, lon):
    x, y = project(lat, lon)
    return (HALF_EXTENT_M - y) / PIXEL_M - 0.5, (x + HALF_EXTENT_M) / PIXEL_M - 0.5


@pytest.fixture
def dem_path(tmp_path):
    path = tmp_path / "pole.tif"
    n = int(2 * HALF_EXTENT_M / PIXEL_M)
    data = np.full((n, n), 5.0, dtype="float32")
    row, col = pixel_of(-89.9, 0.0)
    data[round(row), round(col)] = NODATA
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=n,
        width=n,
        count=1,
        dtype="float32",
        crs=RioCRS.from_string(MOON_SOUTH_STEREO),
        transform=from_origin(-HALF_EXTENT_M, HALF_EXTENT_M, PIXEL_M, PIXEL_M),
        nodata=NODATA,
    ) as dst:
        dst.write(data, 1)
    return str(path)


def angular_difference(a, b):
    return abs((a - b + 180.0) % 360.0 - 180.0)


@pytest.mark.parametrize("lon", [0.0, 90.0])
def test_north_bearing_equals_longitude(dem_path, lon):
    crop = load_dem_crop(dem_path, -89.9, lon, radius_m=1000.0)
    assert angular_difference(crop.north_bearing_deg, lon) < 0.05


def test_pixel_size_and_observer_pixel(dem_path):
    crop = load_dem_crop(dem_path, -89.9, 0.0, radius_m=1000.0)
    row, col = pixel_of(-89.9, 0.0)
    assert crop.pixel_m == 20.0
    # crop starts at (round(row) - 50, round(col) - 50)
    expected = (row - (round(row) - 50), col - (round(col) - 50))
    assert abs(crop.observer_rc[0] - expected[0]) < 0.5
    assert abs(crop.observer_rc[1] - expected[1]) < 0.5


def test_nodata_becomes_nan(dem_path):
    crop = load_dem_crop(dem_path, -89.9, 0.0, radius_m=1000.0)
    assert np.isnan(crop.heights).sum() == 1
    assert np.all(crop.heights[np.isfinite(crop.heights)] == 5.0)


def test_site_outside_raster_raises(dem_path):
    with pytest.raises(ValueError):
        load_dem_crop(dem_path, -80.0, 0.0, radius_m=1000.0)
