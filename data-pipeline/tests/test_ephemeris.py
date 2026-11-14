import numpy as np

from lunarnav.ephemeris import compute_ephemeris


def test_default_count(kernels_ready):
    eph = compute_ephemeris(-89.99, 0.0, cache_dir=kernels_ready)
    assert len(eph.sun_el) == 43_824
    assert eph.step_s == 3_600
    assert eph.sun_el.dtype == np.float32


def test_south_pole_sun_stays_near_horizon(kernels_ready):
    # Lunar obliquity is 1.54 deg, so the Sun never strays far from the horizon.
    eph = compute_ephemeris(-89.99, 0.0, cache_dir=kernels_ready)
    assert np.abs(eph.sun_el).max() < 2.0


def test_near_side_center_earth_high(kernels_ready):
    eph = compute_ephemeris(0.0, 0.0, count=720, cache_dir=kernels_ready)
    assert eph.earth_el.min() > 75.0


def test_azimuth_range(kernels_ready):
    eph = compute_ephemeris(-85.0, 45.0, count=48, cache_dir=kernels_ready)
    for az in (eph.sun_az, eph.earth_az):
        assert az.min() >= 0.0 and az.max() < 360.0
