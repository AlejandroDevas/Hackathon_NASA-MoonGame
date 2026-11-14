"""Usage: python scripts/build_site.py <site_id> --dem <geotiff> [--radius-m 10000]
       [--terrain-radius-m 2500] [--far-dem <regional-geotiff>]

Reads config/sites.json, writes web/public/sites/<site_id>/ and updates index.json.
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from lunarnav.build import build_site  # noqa: E402

OUT_ROOT = ROOT.parent / "web" / "public" / "sites"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("site_id")
    parser.add_argument("--dem", required=True, help="path to the site's height GeoTIFF")
    parser.add_argument("--radius-m", type=float, default=10_000.0)
    parser.add_argument("--terrain-radius-m", type=float, default=2_500.0)
    parser.add_argument("--far-dem", help="optional lower-resolution regional DEM for distant horizon")
    parser.add_argument("--far-radius-m", type=float, default=300_000.0)
    parser.add_argument(
        "--far-start-distance-m",
        type=float,
        help="where the regional DEM begins contributing; defaults to 75%% of --radius-m for overlap",
    )
    args = parser.parse_args()

    sites = json.loads((ROOT / "config" / "sites.json").read_text(encoding="utf-8"))
    site = next((s for s in sites if s["id"] == args.site_id), None)
    if site is None:
        sys.exit(f"unknown site id: {args.site_id}")
    out = build_site(
        site,
        args.dem,
        OUT_ROOT,
        radius_m=args.radius_m,
        cache_dir=ROOT / "cache",
        terrain_radius_m=args.terrain_radius_m,
        far_dem_path=args.far_dem,
        far_radius_m=args.far_radius_m,
        far_start_distance_m=args.far_start_distance_m,
    )
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
