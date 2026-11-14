import json
from datetime import datetime, timezone

import numpy as np

from lunarnav.ephemeris import Ephemeris
from lunarnav.export import write_site

SITE = {
    "id": "demo",
    "name": "Demo site",
    "lat_deg": -89.5,
    "lon_deg": 12.0,
    "observer_height_m": 2.0,
    "coordinates_source": "unit test",
    "sign": {
        "es": {"title": "Sitio", "body": "Cuerpo", "facts": ["a", "b"]},
        "en": {"title": "Site", "body": "Body", "facts": ["a", "b"]},
    },
    "sources": ["https://example.org"],
}


def make_ephemeris(count):
    rng = np.random.default_rng(0)
    arrays = [rng.uniform(-3, 3, count).astype(np.float32) for _ in range(4)]
    return Ephemeris(datetime(2026, 1, 1, tzinfo=timezone.utc), 3600, *arrays)


def test_json_files_are_utf8_with_accents(tmp_path):
    site = {**SITE, "sign": {**SITE["sign"], "es": {"title": "Cresta de conexión", "body": "b", "facts": ["a", "b"]}}}
    write_site(tmp_path, site, np.zeros(360), make_ephemeris(4))
    info = json.loads((tmp_path / "info.json").read_bytes().decode("utf-8"))
    assert info["sign"]["es"]["title"] == "Cresta de conexión"


def test_roundtrip(tmp_path):
    eph = make_ephemeris(48)
    horizon = np.linspace(-0.1, 2.0, 360)
    write_site(tmp_path, SITE, horizon, eph)

    raw = tmp_path / "ephemeris.bin"
    assert raw.stat().st_size == 48 * 16
    data = np.fromfile(raw, dtype="<f4").reshape(48, 4)
    assert np.array_equal(data[:, 0], eph.sun_el)
    assert np.array_equal(data[:, 1], eph.sun_az)
    assert np.array_equal(data[:, 2], eph.earth_el)
    assert np.array_equal(data[:, 3], eph.earth_az)

    horizon_json = json.loads((tmp_path / "horizon.json").read_text())
    assert horizon_json["azimuth_step_deg"] == 1
    assert len(horizon_json["elevation_deg"]) == 360

    info = json.loads((tmp_path / "info.json").read_text())
    assert info["id"] == "demo"
    assert info["sign"]["es"]["title"] == "Sitio"
    assert info["ephemeris"] == {
        "start_utc": "2026-01-01T00:00:00Z",
        "step_s": 3600,
        "count": 48,
        "file": "ephemeris.bin",
    }
    assert info["bodies"] == {"sun_radius_deg": 0.2666, "earth_radius_deg": 0}
