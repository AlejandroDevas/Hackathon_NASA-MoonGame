/**
 * Terrain height map and its conversion to scene coordinates.
 * Scene axes: x = east, y = up, z = south (north = -z); origin at the site point.
 *
 * @typedef {{rows: number, cols: number, pixelM: number, minM: number, maxM: number,
 *   observerRc: number[], northBearingDeg: number, heights: Float32Array}} Terrain
 */

const RAD = Math.PI / 180;

/**
 * @param {ArrayBuffer} buffer uint16 LE, row-major, normalised between min_m and max_m
 * @param {object} meta the `info.terrain` block
 * @returns {Terrain}
 */
export function parseTerrain(buffer, meta) {
  const expected = meta.rows * meta.cols * 2;
  if (buffer.byteLength !== expected) {
    throw new Error(
      `${meta.file ?? 'terrain.bin'}: expected ${expected} bytes for ${meta.rows}x${meta.cols}, got ${buffer.byteLength}`,
    );
  }
  const raw = new Uint16Array(buffer);
  const span = meta.max_m - meta.min_m;
  const heights = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) heights[i] = meta.min_m + (raw[i] / 65535) * span;
  return {
    rows: meta.rows,
    cols: meta.cols,
    pixelM: meta.pixel_m,
    minM: meta.min_m,
    maxM: meta.max_m,
    observerRc: meta.observer_rc,
    northBearingDeg: meta.north_bearing_deg,
    heights,
  };
}

/** Scene (x, z) of the centre of grid cell (r, c); r, c may be fractional. */
export function gridToScene(t, r, c) {
  const beta = t.northBearingDeg * RAD;
  const right = (c - t.observerRc[1]) * t.pixelM;
  const up = (t.observerRc[0] - r) * t.pixelM;
  const north = up * Math.cos(beta) + right * Math.sin(beta);
  return { x: right * Math.cos(beta) - up * Math.sin(beta), z: -north };
}

/** Fractional grid (r, c) of the scene point (x, z). */
export function sceneToGrid(t, x, z) {
  const beta = t.northBearingDeg * RAD;
  const north = -z;
  const right = x * Math.cos(beta) + north * Math.sin(beta);
  const up = north * Math.cos(beta) - x * Math.sin(beta);
  return { r: t.observerRc[0] - up / t.pixelM, c: t.observerRc[1] + right / t.pixelM };
}

export function contains(t, x, z) {
  const { r, c } = sceneToGrid(t, x, z);
  return r >= 0 && r <= t.rows - 1 && c >= 0 && c <= t.cols - 1;
}

/** Bilinear height in metres; NaN outside the terrain. */
export function heightAt(t, x, z) {
  const { r, c } = sceneToGrid(t, x, z);
  if (!(r >= 0 && r <= t.rows - 1 && c >= 0 && c <= t.cols - 1)) return NaN;
  const r0 = Math.min(Math.floor(r), t.rows - 2);
  const c0 = Math.min(Math.floor(c), t.cols - 2);
  const fr = r - r0;
  const fc = c - c0;
  const h = t.heights;
  const i = r0 * t.cols + c0;
  return (
    h[i] * (1 - fr) * (1 - fc) + h[i + 1] * (1 - fr) * fc + h[i + t.cols] * fr * (1 - fc) + h[i + t.cols + 1] * fr * fc
  );
}

function gradient(t, x, z) {
  const p = t.pixelM;
  const dhdx = (heightAt(t, x + p, z) - heightAt(t, x - p, z)) / (2 * p);
  const dhdz = (heightAt(t, x, z + p) - heightAt(t, x, z - p)) / (2 * p);
  return { dhdx, dhdz };
}

/** Slope in degrees from the central-difference gradient (+-1 pixel); Infinity if it leaves the terrain. */
export function slopeDegAt(t, x, z) {
  const { dhdx, dhdz } = gradient(t, x, z);
  if (Number.isNaN(dhdx) || Number.isNaN(dhdz)) return Infinity;
  return Math.atan(Math.hypot(dhdx, dhdz)) / RAD;
}

/** Unit surface normal in scene coordinates (y up). */
export function normalAt(t, x, z) {
  const { dhdx, dhdz } = gradient(t, x, z);
  if (Number.isNaN(dhdx) || Number.isNaN(dhdz)) return { x: 0, y: 1, z: 0 };
  const length = Math.hypot(dhdx, 1, dhdz);
  return { x: -dhdx / length, y: 1 / length, z: -dhdz / length };
}

/**
 * A short fingerprint of the raw terrain bytes (FNV-1a over 32-bit words plus the length), used to tell
 * whether data computed from a terrain, such as the rover's start, still belongs to it.
 * @param {ArrayBuffer} buffer
 */
export function terrainFingerprint(buffer) {
  const words = new Uint32Array(buffer, 0, buffer.byteLength >> 2);
  let hash = 2166136261;
  for (let i = 0; i < words.length; i++) hash = Math.imul(hash ^ words[i], 16777619) >>> 0;
  return `${hash.toString(16)}:${buffer.byteLength}`;
}
