"""Usage: python scripts/build_site.py <site_id> --dem <geotiff> [--radius-m 10000] [--terrain-radius-m 2500]

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
    args = parser.parse_args()

    sites = json.loads((ROOT / "config" / "sites.json").read_text(encoding="utf-8"))
    site = next((s for s in sites if s["id"] == args.site_id), None)
    if site is None:
        sys.exit(f"unknown site id: {args.site_id}")
    out = build_site(
        site, args.dem, OUT_ROOT, args.radius_m, ROOT / "cache", args.terrain_radius_m
    )
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
