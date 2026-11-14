"""Regenerate the synthetic site used by the web tests: web/tests/fixtures/tiny-site/."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from lunarnav.fixture import build_tiny_site  # noqa: E402

if __name__ == "__main__":
    print(f"wrote {build_tiny_site(ROOT.parent / 'web' / 'tests' / 'fixtures')}")
