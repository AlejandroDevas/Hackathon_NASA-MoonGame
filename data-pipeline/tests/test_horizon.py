import numpy as np

from lunarnav.horizon import MOON_RADIUS_M, compute_horizon

PIXEL_M = 5.0
# Geometric dip of a 2 m observer on a flat sphere: acos(R / (R + 2)).
FLAT_DIP_DEG = -np.degrees(np.arccos(MOON_RADIUS_M / (MOON_RADIUS_M + 2.0)))


def ridge_dem():
    """400x1000 px DEM at 5 m/px, observer at (200, 500); a 100 m wall starts
    1000 m east of the observer (columns >= 700). The west side is wide enough
    (2500 m) to reach the horizon-dip distance of a 2 m observer (~2636 m)."""
    dem = np.zeros((400, 1000))
    dem[:, 700:] = 100.0
    return dem


def test_flat_terrain_gives_geometric_dip():
    dem = np.zeros((1000, 1000))
    h = compute_horizon(dem, PIXEL_M, (500, 500), 0.0)
    assert h.shape == (360,)
    assert np.allclose(h, FLAT_DIP_DEG, atol=0.005)


def test_ridge_east():
    h = compute_horizon(ridge_dem(), PIXEL_M, (200, 500), 0.0)
    assert abs(h[90] - 5.60) < 0.05
    assert abs(h[270] - FLAT_DIP_DEG) < 0.005


def test_north_bearing_rotates():
    h = compute_horizon(ridge_dem(), PIXEL_M, (200, 500), 90.0)
    assert abs(h[0] - 5.60) < 0.05


def test_nan_and_edge_never_nan():
    dem = ridge_dem()
    dem[:, 600:610] = np.nan
    h = compute_horizon(dem, PIXEL_M, (200, 5), 0.0)
    assert np.isfinite(h).all()


def test_nan_under_observer_stays_finite():
    dem = ridge_dem()
    dem[195:206, 495:506] = np.nan
    h = compute_horizon(dem, PIXEL_M, (200, 500), 0.0)
    assert np.isfinite(h).all()
