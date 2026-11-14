"""Compare compute_ephemeris against JPL Horizons for one week of hourly samples.

Usage: python scripts/validate_horizons.py
Only public lunar coordinates are sent to the Horizons API.
"""

import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from lunarnav.ephemeris import compute_ephemeris  # noqa: E402

API = "https://ssd.jpl.nasa.gov/api/horizons.api"
START = datetime(2026, 1, 1, tzinfo=timezone.utc)
HOURS = 168
POINTS = [  # (label, lat, lon, compare azimuth too?)
    ("Site 01 centre", -89.4632, -137.4896, False),  # azimuth is ill-conditioned near the pole
    ("Sub-Earth region (0, 0)", 0.0, 0.0, True),
]
LIMITS = {"el": 0.1, "az": 0.2}  # degrees


def horizons(body_id: str, lat: float, lon: float):
    stop = START + timedelta(hours=HOURS - 1)
    params = {
        "format": "text",
        "COMMAND": f"'{body_id}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon},{lat},0'",
        "START_TIME": f"'{START:%Y-%m-%d %H:%M}'",
        "STOP_TIME": f"'{stop:%Y-%m-%d %H:%M}'",
        "STEP_SIZE": "'1 h'",
        "QUANTITIES": "'4'",
        "ANG_FORMAT": "'DEG'",
        "CSV_FORMAT": "'YES'",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=60) as response:
        text = response.read().decode()
    rows = text.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines()
    parsed = [[p.strip() for p in row.split(",")] for row in rows]
    az = np.array([float(p[3]) for p in parsed])
    el = np.array([float(p[4]) for p in parsed])
    return az, el


def circular_diff(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return np.abs((a - b + 180.0) % 360.0 - 180.0)


def main() -> int:
    failed = False
    print("| Point | Body | Max elevation diff (deg) | Max azimuth diff (deg) |")
    print("|---|---|---|---|")
    for label, lat, lon, with_az in POINTS:
        ours = compute_ephemeris(lat, lon, START, HOURS, cache_dir=ROOT / "cache")
        for body, body_id, our_el, our_az in (
            ("Sun", "10", ours.sun_el, ours.sun_az),
            ("Earth", "399", ours.earth_el, ours.earth_az),
        ):
            ref_az, ref_el = horizons(body_id, lat, lon)
            d_el = float(np.abs(our_el - ref_el).max())
            d_az = float(circular_diff(our_az, ref_az).max()) if with_az else None
            failed |= d_el > LIMITS["el"] or (d_az is not None and d_az > LIMITS["az"])
            az_text = f"{d_az:.4f}" if d_az is not None else "n/a (near pole)"
            print(f"| {label} | {body} | {d_el:.4f} | {az_text} |")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
