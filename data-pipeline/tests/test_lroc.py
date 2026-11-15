import numpy as np
import pytest

from lunarnav import lroc


def test_polar_xy_round_trips_through_the_inverse():
    for lat, lon in [(-89.463, 222.51), (-86.764, 337.22), (-85.995, 359.76), (-89.767, 188.13)]:
        x, y = lroc.polar_xy(lat, lon)
        colat, lon_back = lroc.polar_inverse(np.array([x]), np.array([y]))
        assert colat[0] == pytest.approx(90.0 + lat, abs=1e-9)
        assert lon_back[0] == pytest.approx(lon % 360.0, abs=1e-9)


def test_tile_names_match_the_mosaic_listing():
    # names read from the LROC archive listing
    assert lroc.tile_name(0, 2) == "NAC_POLE_P892S2250"
    assert lroc.tile_name(1, 7) == "NAC_POLE_P880S3375"
    assert lroc.tile_name(3, 15) == "NAC_POLE_P860S3487"
    assert lroc.tile_name(3, 0) == "NAC_POLE_P860S0112"
    assert lroc.tile_name(2, 11) == "NAC_POLE_P870S3450"
    assert lroc.tile_name(0, 0) == "NAC_POLE_P892S0450"


def test_the_four_bands_have_40_distinct_tiles():
    names = {lroc.tile_name(b, s) for b, (_, _, n) in enumerate(lroc.BANDS) for s in range(n)}
    assert len(names) == 40


def test_parse_tile_name_inverts_tile_name():
    for b, (_, _, n) in enumerate(lroc.BANDS):
        for s in range(n):
            assert lroc.parse_tile_name(lroc.tile_name(b, s)) == (b, s)


def test_tile_bounds_agree_with_the_geotiff_headers_read_from_the_archive():
    # (xmin, ymin, xmax, ymax) from the GeoTIFF headers; the images are whole metres wide
    expected = {
        (0, 2): (-45488, -45488, 0, 0),
        (1, 7): (-53614, 32164, 0, 75821),
        (3, 15): (-52246, 98083, 0, 136526),
    }
    for (band, sector), box in expected.items():
        got = lroc.tile_bounds(band, sector)
        for g, e in zip(got, box):
            assert g == pytest.approx(e, abs=2.0)


def test_tile_for_picks_band_and_sector_and_flags_points_outside_the_mosaic():
    colat = np.array([0.2, 2.0, 3.0, 4.0, 4.6, 6.0])
    lon = np.array([225.0, 337.0, 100.0, 350.0, 10.0, 10.0])
    band, sector = lroc.tile_for(colat, lon)
    assert band.tolist() == [0, 1, 2, 3, -1, -1]
    assert sector.tolist() == [2, 7, 3, 15, 0, 0]


def test_tiles_needed_lists_each_tile_once_and_skips_outside_points():
    x1, y1 = lroc.polar_xy(-89.463, 222.51)
    x2, y2 = lroc.polar_xy(-89.767, 188.13)
    x3, y3 = lroc.polar_xy(-85.438, 37.37)  # Nobile Rim 1: closer to the equator than 85.5 S
    names = lroc.tiles_needed(np.array([x1, x2, x3, x1]), np.array([y1, y2, y3, y1]))
    assert names == ["NAC_POLE_P892S2250"]  # 188 and 222 deg are both in the 180-270 deg sector


def test_sample_tones_reads_the_right_tile_at_the_right_place():
    # a tile whose columns increase from 10 to 250 left to right, rows constant
    cols = np.linspace(10, 250, 200)
    image = np.tile(cols, (100, 1)).astype(np.uint8)
    xmin, ymin, xmax, ymax = lroc.tile_bounds(0, 2)
    x = np.array([xmin + 0.25 * (xmax - xmin), xmin + 0.75 * (xmax - xmin)])
    y = np.array([ymin + 0.5 * (ymax - ymin)] * 2)
    # keep only points that really are in sector 2 of band 0
    colat, lon = lroc.polar_inverse(x, y)
    band, sector = lroc.tile_for(colat, lon)
    assert band.tolist() == [0, 0] and sector.tolist() == [2, 2]
    tones = lroc.sample_tones(x, y, lambda name: image if name == "NAC_POLE_P892S2250" else None)
    assert tones[0] == pytest.approx(10 + 0.25 * 240, abs=2.5)
    assert tones[1] == pytest.approx(10 + 0.75 * 240, abs=2.5)


def test_sample_tones_is_nan_without_an_image_or_for_no_data_pixels():
    x, y = lroc.polar_xy(-89.463, 222.51)
    assert np.isnan(lroc.sample_tones(np.array([x]), np.array([y]), lambda name: None)[0])
    zero = np.zeros((50, 50), dtype=np.uint8)
    assert np.isnan(lroc.sample_tones(np.array([x]), np.array([y]), lambda name: zero)[0])
    outside = lroc.polar_xy(-85.0, 10.0)
    assert np.isnan(lroc.sample_tones(np.array([outside[0]]), np.array([outside[1]]), lambda name: np.ones((5, 5), np.uint8))[0])


def test_the_image_scale_comes_from_the_png_size():
    # the same ground point reads the same tone whether the browse image is 100 or 400 px wide
    big = np.tile(np.linspace(10, 250, 400), (400, 1))
    small = np.tile(np.linspace(10, 250, 100), (100, 1))
    xmin, ymin, xmax, ymax = lroc.tile_bounds(0, 2)
    x = np.array([xmin + 0.4 * (xmax - xmin)])
    y = np.array([ymin + 0.4 * (ymax - ymin)])
    a = lroc.sample_tones(x, y, lambda n: big.astype(np.uint8))[0]
    b = lroc.sample_tones(x, y, lambda n: small.astype(np.uint8))[0]
    assert a == pytest.approx(b, abs=3.0)
