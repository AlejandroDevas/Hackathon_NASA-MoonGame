"""Write a site's static data files for the web app."""

import json
from pathlib import Path

import numpy as np

from lunarnav.ephemeris import Ephemeris

SUN_RADIUS_DEG = 0.2666
EARTH_RADIUS_DEG = 0


def write_site(out_dir: Path, site: dict, horizon: np.ndarray, eph: Ephemeris) -> None:
    """Write ``ephemeris.bin`` (float32 LE, per sample [sun_el, sun_az, earth_el,
    earth_az]), ``horizon.json`` and ``info.json`` into ``out_dir``."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    samples = np.stack([eph.sun_el, eph.sun_az, eph.earth_el, eph.earth_az], axis=1)
    samples.astype("<f4").tofile(out_dir / "ephemeris.bin")

    horizon_json = {
        "azimuth_step_deg": 1,
        "elevation_deg": [float(v) for v in horizon],
    }
    (out_dir / "horizon.json").write_text(json.dumps(horizon_json))

    info = {
        **site,
        "ephemeris": {
            "start_utc": eph.start_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "step_s": eph.step_s,
            "count": int(len(eph.sun_el)),
            "file": "ephemeris.bin",
        },
        "bodies": {"sun_radius_deg": SUN_RADIUS_DEG, "earth_radius_deg": EARTH_RADIUS_DEG},
    }
    (out_dir / "info.json").write_text(json.dumps(info, ensure_ascii=False, indent=2))
