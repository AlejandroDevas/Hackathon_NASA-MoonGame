import json
from pathlib import Path

import pytest

SITES = json.loads(
    (Path(__file__).resolve().parent.parent / "config" / "sites.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize("site", SITES, ids=lambda s: s["id"])
def test_site_is_complete(site):
    assert -90 <= site["lat_deg"] <= 90
    assert -360 <= site["lon_deg"] <= 360
    assert site["observer_height_m"] > 0
    assert site["coordinates_source"].strip()
    assert site["sources"], "a site needs at least one cited source"
    for lang in ("es", "en"):
        sign = site["sign"][lang]
        assert sign["title"].strip() and sign["body"].strip()
        assert len(sign["facts"]) >= 2
