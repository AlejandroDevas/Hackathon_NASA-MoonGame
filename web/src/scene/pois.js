import { gridToScene } from './terrainData.js';

/** Points of interest closer than this to the site sign are not repeated as separate markers. */
const MIN_SEPARATION_M = 80;
/** Cells ignored along the map border, where interpolated edge pixels are least reliable. */
const EDGE_MARGIN_PX = 12;

/**
 * Landmarks of a site, taken from its real height map: the sign at the site point,
 * the highest point and the lowest point of the mapped area.
 * @param {import('./terrainData.js').Terrain} terrain
 * @returns {Array<{id: 'goal'|'high'|'low', x: number, z: number, heightM: number}>}
 */
export function findPois(terrain) {
  const { rows, cols, heights } = terrain;
  let high = null;
  let low = null;
  for (let r = EDGE_MARGIN_PX; r < rows - EDGE_MARGIN_PX; r++) {
    for (let c = EDGE_MARGIN_PX; c < cols - EDGE_MARGIN_PX; c++) {
      const h = heights[r * cols + c];
      if (!Number.isFinite(h)) continue;
      if (!high || h > high.h) high = { h, r, c };
      if (!low || h < low.h) low = { h, r, c };
    }
  }
  const at = (id, p) => {
    const { x, z } = gridToScene(terrain, p.r, p.c);
    return { id, x, z, heightM: p.h };
  };
  const goalHeight = heights[Math.round(terrain.observerRc[0]) * cols + Math.round(terrain.observerRc[1])];
  const pois = [{ id: 'goal', x: 0, z: 0, heightM: goalHeight }];
  for (const [id, p] of [['high', high], ['low', low]]) {
    if (!p) continue;
    const poi = at(id, p);
    if (Math.hypot(poi.x, poi.z) >= MIN_SEPARATION_M) pois.push(poi);
  }
  // a flat map has nothing to tell apart
  if (high && low && high.h - low.h < 1) return pois.filter((p) => p.id === 'goal');
  return pois;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Compass key (N, NE, ...) of a bearing in degrees, 0 = north, clockwise. */
export function compassKey(bearingDeg) {
  const sector = Math.round((((bearingDeg % 360) + 360) % 360) / 45) % 8;
  return COMPASS[sector];
}

/**
 * Distance and compass bearing from `from` to `poi`, in scene axes (north = -z).
 * @returns {{distanceM: number, bearingDeg: number, compass: string}}
 */
export function relativeTo(poi, from) {
  const dx = poi.x - from.x;
  const dz = poi.z - from.z;
  const bearingDeg = (((Math.atan2(dx, -dz) * 180) / Math.PI) + 360) % 360;
  return { distanceM: Math.hypot(dx, dz), bearingDeg, compass: compassKey(bearingDeg) };
}
