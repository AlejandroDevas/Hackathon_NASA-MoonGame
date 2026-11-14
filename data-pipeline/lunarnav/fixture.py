"""Deterministic synthetic site used by the web tests (not real lunar data)."""

from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from lunarnav.ephemeris import Ephemeris
from lunarnav.export import write_site

COUNT = 48


def build_tiny_site(out_root: Path) -> Path:
    i = np.arange(COUNT)
    earth_el = np.where((i >= 12) & (i < 20), -1.0, 5.0)
    eph = Ephemeris(
        start_utc=datetime(2026, 1, 1, tzinfo=timezone.utc),
        step_s=3600,
        sun_el=(3 * np.sin(2 * np.pi * i / 24)).astype(np.float32),
        sun_az=np.full(COUNT, 90.0, dtype=np.float32),
        earth_el=earth_el.astype(np.float32),
        earth_az=np.full(COUNT, 180.0, dtype=np.float32),
    )
    horizon = np.full(360, -0.1)
    horizon[90] = 2.0
    site = {
        "id": "tiny-site",
        "name": "Tiny synthetic site",
        "lat_deg": -89.0,
        "lon_deg": 0.0,
        "observer_height_m": 2.0,
        "coordinates_source": "synthetic test fixture",
        "sign": {
            "es": {"title": "Sitio sintético", "body": "Datos de prueba.", "facts": ["a", "b"]},
            "en": {"title": "Synthetic site", "body": "Test data.", "facts": ["a", "b"]},
        },
        "sources": [],
    }
    out_dir = Path(out_root) / site["id"]
    write_site(out_dir, site, horizon, eph)
    return out_dir
