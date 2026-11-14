from pathlib import Path

import pytest

CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"
KERNELS = [
    "de421.bsp",
    "moon_pa_de421_1900-2050.bpc",
    "moon_080317.tf",
    "pck00008.tpc",
]


@pytest.fixture(scope="session")
def kernels_ready() -> Path:
    """Cache directory holding the SPICE kernels; skips the test when missing."""
    missing = [k for k in KERNELS if not (CACHE_DIR / k).exists()]
    if missing:
        pytest.skip(f"SPICE kernels not downloaded: {', '.join(missing)}")
    return CACHE_DIR
