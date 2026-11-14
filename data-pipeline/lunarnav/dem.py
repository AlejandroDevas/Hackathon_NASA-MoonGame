"""Crop a polar-stereographic LOLA DEM around a site."""

import math
from dataclasses import dataclass

import numpy as np
import rasterio
from pyproj import CRS, Transformer
from rasterio.windows import Window


@dataclass
class DemCrop:
    heights: np.ndarray  # float64 metres, NaN where there is no data
    pixel_m: float
    observer_rc: tuple[float, float]  # fractional (row, col) of the site in `heights`
    north_bearing_deg: float  # true north, clockwise from grid "up"


def load_dem_crop(
    path: str, lat_deg: float, lon_deg: float, radius_m: float = 10_000.0
) -> DemCrop:
    with rasterio.open(path) as src:
        crs = CRS.from_wkt(src.crs.to_wkt())
        forward = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
        x, y = forward.transform(lon_deg, lat_deg)
        x_n, y_n = forward.transform(lon_deg, lat_deg + 0.001)
        north_bearing = math.degrees(math.atan2(x_n - x, y_n - y)) % 360.0

        col_edge, row_edge = (~src.transform) @ (x, y)
        if not (0 <= row_edge < src.height and 0 <= col_edge < src.width):
            raise ValueError(f"({lat_deg}, {lon_deg}) is outside the raster {path}")
        # pixel indices refer to pixel centres
        row, col = row_edge - 0.5, col_edge - 0.5

        pixel_m = abs(src.transform.a)
        half = math.ceil(radius_m / pixel_m)
        row0 = max(round(row) - half, 0)
        col0 = max(round(col) - half, 0)
        row1 = min(round(row) + half + 1, src.height)
        col1 = min(round(col) + half + 1, src.width)
        window = Window(col0, row0, col1 - col0, row1 - row0)
        heights = src.read(1, window=window, masked=True).astype("float64").filled(np.nan)

    return DemCrop(
        heights=heights,
        pixel_m=pixel_m,
        observer_rc=(row - row0, col - col0),
        north_bearing_deg=north_bearing,
    )
