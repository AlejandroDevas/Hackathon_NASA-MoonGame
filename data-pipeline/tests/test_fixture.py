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
