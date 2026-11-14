import numpy as np
import pytest

from lunarnav.dem import DemCrop
from lunarnav.terrain import encode_terrain, write_terrain


def decode(encoded, min_m, max_m):
    return min_m + encoded.astype(float) / 65535 * (max_m - min_m)


def test_encode_roundtrip():
    rng = np.random.default_rng(1)
    heights = rng.uniform(1100, 1960, (40, 30))
    encoded, min_m, max_m = encode_terrain(heights)
    assert encoded.dtype == np.uint16 and encoded.shape == heights.shape
    assert min_m == pytest.approx(heights.min()) and max_m == pytest.approx(heights.max())
    assert np.abs(decode(encoded, min_m, max_m) - heights).max() <= (max_m - min_m) / 65535


def test_nan_becomes_min():
    heights = np.array([[1.0, np.nan], [3.0, 2.0]])
    encoded, min_m, max_m = encode_terrain(heights)
    assert (min_m, max_m) == (1.0, 3.0)
    assert encoded[0, 1] == 0


def test_constant_dem_does_not_divide_by_zero():
    encoded, min_m, max_m = encode_terrain(np.full((4, 4), 7.5))
    assert np.allclose(decode(encoded, min_m, max_m), 7.5)


def test_all_nan_raises():
    with pytest.raises(ValueError):
        encode_terrain(np.full((3, 3), np.nan))


def test_write_terrain_block(tmp_path):
    crop = DemCrop(
        heights=np.linspace(0, 10, 12).reshape(3, 4),
        pixel_m=5.0,
        observer_rc=(1.5, 2.0),
        north_bearing_deg=222.5,
    )
    block = write_terrain(tmp_path, crop)
    assert (tmp_path / "terrain.bin").stat().st_size == 3 * 4 * 2
    assert block == {
        "file": "terrain.bin",
        "rows": 3,
        "cols": 4,
        "pixel_m": 5.0,
        "min_m": 0.0,
        "max_m": 10.0,
        "observer_rc": [1.5, 2.0],
        "north_bearing_deg": 222.5,
    }
    raw = np.fromfile(tmp_path / "terrain.bin", dtype="<u2").reshape(3, 4)
    assert raw[0, 0] == 0 and raw[2, 3] == 65535
