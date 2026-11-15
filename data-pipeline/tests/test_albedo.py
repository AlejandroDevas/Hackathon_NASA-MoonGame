import json

import numpy as np
import pytest

from lunarnav import albedo, lroc

TERRAIN = {"rows": 101, "cols": 101, "pixel_m": 5.0, "observer_rc": [50.0, 50.0], "north_bearing_deg": 0.0}
SITE = {"id": "t", "lat_deg": -89.463, "lon_deg": -137.4896}


def test_grid_cell_at_the_observer_is_the_site_and_axes_follow_the_projection():
    x, y = albedo.terrain_grid_xy(SITE, TERRAIN)
    sx, sy = lroc.polar_xy(SITE["lat_deg"], SITE["lon_deg"])
    assert x[50, 50] == pytest.approx(sx)
    assert y[50, 50] == pytest.approx(sy)
    # one cell to the right is +5 m in x; one row down is -5 m in y
    assert x[50, 51] - x[50, 50] == pytest.approx(5.0)
    assert y[51, 50] - y[50, 50] == pytest.approx(-5.0)
    assert x.shape == y.shape == (101, 101)


def test_tiles_for_a_polar_site_and_for_one_outside_the_mosaic():
    assert albedo.tiles_for_site(SITE, TERRAIN) == ["NAC_POLE_P892S2250"]
    nobile = {"lat_deg": -85.4381005, "lon_deg": 37.3666694}
    big = {**TERRAIN, "rows": 1001, "cols": 1001, "observer_rc": [500.0, 500.0]}
    # only a sliver of Nobile Rim 1 is inside the mosaic: it needs a tile, but coverage is small
    assert albedo.tiles_for_site(nobile, big) == ["NAC_POLE_P860S0337"]


def test_relative_tone_of_an_even_lit_image_is_neutral():
    tones = np.full((60, 60), 120.0)
    out = albedo.relative_tone(tones)
    assert out.dtype == np.uint8
    assert np.all(out == albedo.NEUTRAL)


def test_shadow_and_missing_data_carry_no_information():
    tones = np.full((60, 60), 120.0)
    tones[:20] = 2.0  # deep shadow
    tones[40:, 40:] = np.nan  # outside the mosaic
    out = albedo.relative_tone(tones)
    assert np.all(out[:20] == 0)
    assert np.all(out[40:, 40:] == 0)
    assert np.all(out[20:40, :40] == albedo.NEUTRAL)


def test_brighter_and_darker_patches_stand_out_from_their_surroundings():
    tones = np.full((80, 80), 100.0)
    tones[38:42, 38:42] = 180.0  # a bright patch, e.g. fresh ejecta
    tones[10:14, 10:14] = 50.0  # a darker patch
    out = albedo.relative_tone(tones)
    assert out[40, 40] > albedo.NEUTRAL * 1.3
    assert out[12, 12] < albedo.NEUTRAL * 0.8
    assert out[60, 60] == albedo.NEUTRAL


def test_a_slow_brightness_gradient_is_removed_but_local_contrast_stays():
    # the Sun's lighting changes smoothly across the image; a crater is a local feature
    ramp = np.tile(np.linspace(80, 200, 120), (120, 1))
    ramp[60:64, 60:64] *= 1.5
    out = albedo.relative_tone(ramp)
    far_apart = [int(out[20, 10]), int(out[20, 100])]
    assert all(abs(v - albedo.NEUTRAL) <= 12 for v in far_apart)
    assert out[62, 62] > albedo.NEUTRAL * 1.2


def test_relative_tone_is_clamped_and_never_zero_where_there_is_information():
    tones = np.full((60, 60), 100.0)
    tones[30, 30] = 255.0
    out = albedo.relative_tone(tones)
    assert out[30, 30] <= albedo.REL_MAX * albedo.NEUTRAL + 1
    assert out[out > 0].min() >= 1
    assert albedo.relative_tone(np.full((5, 5), np.nan)).sum() == 0


def test_build_albedo_reports_coverage_and_uses_the_tile_loader():
    full = np.full((200, 200), 150, dtype=np.uint8)
    tones, coverage = albedo.build_albedo(SITE, TERRAIN, lambda name: full)
    assert coverage == 1.0
    assert tones.shape == (101, 101)
    assert np.all(tones == albedo.NEUTRAL)
    tones, coverage = albedo.build_albedo(SITE, TERRAIN, lambda name: None)
    assert coverage == 0.0
    assert not tones.any()


def test_write_albedo_stores_the_bytes_and_records_them_in_info(tmp_path):
    (tmp_path / "info.json").write_text(json.dumps({"id": "t", "terrain": {}}), encoding="utf-8")
    tones = (np.arange(12, dtype=np.uint8).reshape(3, 4)) + 1
    albedo.write_albedo(tmp_path, tones, 0.987, ["NAC_POLE_P892S2250"])
    assert (tmp_path / "albedo.bin").read_bytes() == tones.tobytes()
    info = json.loads((tmp_path / "info.json").read_text(encoding="utf-8"))
    assert info["albedo"]["file"] == "albedo.bin"
    assert (info["albedo"]["rows"], info["albedo"]["cols"]) == (3, 4)
    assert info["albedo"]["coverage"] == 0.987
    assert info["albedo"]["neutral"] == albedo.NEUTRAL
    assert info["albedo"]["tiles"] == ["NAC_POLE_P892S2250"]
    assert info["id"] == "t"  # the rest of the info is kept


def test_box_blur_is_a_mean_filter():
    image = np.zeros((9, 9))
    image[4, 4] = 81.0
    blurred = albedo._box_blur(image, 4)
    assert blurred[4, 4] == pytest.approx(1.0)  # 81 spread over a full 9x9 window
    # at the corner the window is cut to the 5x5 cells inside the image, which still hold the point
    assert blurred[0, 0] == pytest.approx(81.0 / 25.0)
