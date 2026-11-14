"""Deterministic synthetic site used by the web tests (not real lunar data)."""

from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from lunarnav.dem import DemCrop
from lunarnav.ephemeris import Ephemeris
from lunarnav.export import write_site
from lunarnav.terrain import write_terrain

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
    # 101x101 px at 5 m: a 2.29 deg ramp rising to the east plus a 30 m cliff from row 90 (south).
    rows, cols = np.mgrid[0:101, 0:101]
    terrain = DemCrop(
        heights=0.2 * cols + 30.0 * (rows >= 90),
        pixel_m=5.0,
        observer_rc=(50.0, 50.0),
        north_bearing_deg=0.0,
    )
    out_dir = Path(out_root) / site["id"]
    terrain_block = write_terrain(out_dir, terrain)
    write_site(out_dir, site, horizon, eph, terrain=terrain_block)
    return out_dir
