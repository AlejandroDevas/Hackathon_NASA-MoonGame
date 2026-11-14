import json

import numpy as np

from lunarnav.fixture import build_tiny_site


def test_tiny_site_values(tmp_path):
    out = build_tiny_site(tmp_path)
    info = json.loads((out / "info.json").read_text())
    assert info["id"] == "tiny-site"
    assert info["ephemeris"]["count"] == 48

    horizon = json.loads((out / "horizon.json").read_text())["elevation_deg"]
    assert horizon[90] == 2.0 and horizon[0] == -0.1 and horizon[180] == -0.1

    data = np.fromfile(out / "ephemeris.bin", dtype="<f4").reshape(48, 4)
    sun_el, sun_az, earth_el, earth_az = data.T
    assert np.isclose(sun_el[3], 3 * np.sin(2 * np.pi * 3 / 24), atol=1e-5)
    assert np.all(sun_az == 90.0) and np.all(earth_az == 180.0)
    assert np.all(earth_el[12:20] == -1.0)
    assert np.all(np.delete(earth_el, np.arange(12, 20)) == 5.0)


def test_tiny_site_terrain(tmp_path):
    out = build_tiny_site(tmp_path)
    block = json.loads((out / "info.json").read_text(encoding="utf-8"))["terrain"]
    assert block["rows"] == block["cols"] == 101
    assert block["observer_rc"] == [50, 50]
    assert block["north_bearing_deg"] == 0
    assert (block["min_m"], block["max_m"]) == (0, 50)

    raw = np.fromfile(out / "terrain.bin", dtype="<u2").reshape(101, 101)
    heights = block["min_m"] + raw.astype(float) / 65535 * (block["max_m"] - block["min_m"])
    r, c = np.mgrid[0:101, 0:101]
    expected = 0.2 * c + 30.0 * (r >= 90)
    assert np.abs(heights - expected).max() < 0.001
