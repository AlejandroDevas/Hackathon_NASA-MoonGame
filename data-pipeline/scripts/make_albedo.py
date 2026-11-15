"""Add an LROC tone map to sites whose terrain already exists (run after build_site.py).

    python scripts/make_albedo.py --list                # which browse tiles each site needs, nothing fetched
    python scripts/make_albedo.py --download            # fetch those browse PNGs (a few hundred KB each) and build
    python scripts/make_albedo.py site01-connecting-ridge   # one site, tiles already in cache/lroc

Writes web/public/sites/<id>/albedo.bin and an "albedo" block in its info.json. Sites that fall
outside the mosaic (it ends at 85.5 S) are left without one.
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from lunarnav import albedo  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("sites", nargs="*", help="site ids (default: every site with a terrain)")
    parser.add_argument("--list", action="store_true", help="only list the tiles each site needs")
    parser.add_argument("--download", action="store_true", help="fetch missing browse PNGs into the cache")
    parser.add_argument("--cache", type=Path, default=ROOT / "cache" / "lroc")
    parser.add_argument("--web-sites", type=Path, default=ROOT.parent / "web" / "public" / "sites")
    args = parser.parse_args()

    config = {s["id"]: s for s in json.loads((ROOT / "config" / "sites.json").read_text(encoding="utf-8"))}
    ids = args.sites or list(config)
    for site_id in ids:
        site_dir = args.web_sites / site_id
        info = json.loads((site_dir / "info.json").read_text(encoding="utf-8"))
        terrain = info.get("terrain")
        if not terrain:
            print(f"{site_id}: no terrain, skipped")
            continue
        tiles = albedo.tiles_for_site(config[site_id], terrain)
        if not tiles:
            print(f"{site_id}: outside the NAC south-pole mosaic (latitude north of 85.5 S), no tone map")
            continue
        print(f"{site_id}: needs {', '.join(tiles)}")
        if args.list:
            continue
        if args.download:
            for name in tiles:
                path = albedo.download_tile(name, args.cache)
                print(f"   {path.name}: {path.stat().st_size / 1000:.0f} KB")
        tones, coverage = albedo.build_albedo(config[site_id], terrain, albedo.png_loader(args.cache))
        if coverage < albedo.MIN_COVERAGE:
            print(f"   only {coverage:.1%} of the terrain has data: no tone map written")
            continue
        albedo.write_albedo(site_dir, tones, coverage, tiles)
        print(f"   albedo.bin written, {coverage:.1%} of the terrain covered")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
