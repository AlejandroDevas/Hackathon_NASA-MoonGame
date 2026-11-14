"""Sun and Earth elevation/azimuth seen from a lunar surface site (Skyfield + SPICE)."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from skyfield.api import Loader, PlanetaryConstants

DEFAULT_START = datetime(2026, 1, 1, tzinfo=timezone.utc)
DEFAULT_COUNT = 43_824  # 2026-01-01T00:00Z .. 2030-12-31T23:00Z, hourly


@dataclass
class Ephemeris:
    start_utc: datetime
    step_s: int
    sun_el: np.ndarray  # float32, degrees
    sun_az: np.ndarray  # float32, degrees, 0..360 clockwise from north
    earth_el: np.ndarray
    earth_az: np.ndarray


def compute_ephemeris(
    lat_deg: float,
    lon_deg: float,
    start_utc: datetime = DEFAULT_START,
    count: int = DEFAULT_COUNT,
    step_s: int = 3_600,
    cache_dir: Path = Path("cache"),
) -> Ephemeris:
    load = Loader(str(cache_dir))
    ts = load.timescale()
    planets = load("de421.bsp")

    constants = PlanetaryConstants()
    constants.read_text(load("moon_080317.tf"))
    constants.read_text(load("pck00008.tpc"))
    constants.read_binary(load("moon_pa_de421_1900-2050.bpc"))
    frame = constants.build_frame_named("MOON_ME_DE421")
    site = planets["moon"] + constants.build_latlon_degrees(frame, lat_deg, lon_deg)

    offsets = [timedelta(seconds=step_s * i) for i in range(count)]
    times = ts.from_datetimes([start_utc + d for d in offsets])
    observer = site.at(times)

    def altaz(body):
        alt, az, _ = observer.observe(planets[body]).apparent().altaz()
        return alt.degrees.astype(np.float32), (az.degrees % 360.0).astype(np.float32)

    sun_el, sun_az = altaz("sun")
    earth_el, earth_az = altaz("earth")
    return Ephemeris(start_utc, step_s, sun_el, sun_az, earth_el, earth_az)
