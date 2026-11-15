import * as THREE from 'three';
import { REGOLITH_TILE_M } from './regolith.js';

function hash2D(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * Brightness factor (0.5..1) of a terrain vertex: lighter higher up, a broad
 * deterministic mottling, a very subtle grain, and a slightly brighter tone on steep
 * faces (fresh, less weathered regolith, as seen on crater walls). It only affects the
 * look; the geometry stays the LOLA height map.
 */
export function terrainColor(heightM, minM, maxM, r, c, slopeDeg = 0) {
  const span = maxM - minM;
  const elevNorm = span > 0 ? Math.min(Math.max((heightM - minM) / span, 0), 1) : 0.5;
  const grain = (hash2D(r * 0.71, c * 0.71) - 0.5) * 0.06;
  const mottling = 0.05 * Math.sin(r * 0.043 + 1.3) * Math.cos(c * 0.037 + 0.4) + 0.03 * Math.sin((r + c) * 0.11);
  const fresh = 0.12 * Math.min(Math.max(slopeDeg, 0) / 30, 1);
  return Math.min(Math.max(0.62 + elevNorm * 0.3 + grain + mottling + fresh, 0.5), 1);
}

/**
 * How strongly the LROC tone variation shows: 1 would be the measured relative tone, 0 none.
 * The real variation (about +-20 % at 30 m scale) is hard to see under the low polar Sun, so it
 * is shown exaggerated by this factor; the on/off button compares it with the plain terrain.
 */
export const ALBEDO_STRENGTH = 1.7;
/** Value that means "same tone as the surroundings" in a site's tone map. */
export const ALBEDO_NEUTRAL = 100;

/**
 * Relative tone (1 = unchanged) of a tone-map byte: 0 means no information, so the terrain keeps its colour.
 */
export function albedoFactor(byte) {
  return byte === 0 ? 1 : byte / ALBEDO_NEUTRAL;
}

/**
 * Colour the vertices from the stored base shade and relative tone: `strength` blends from
 * the plain terrain shade (0) to the full LROC tone variation (1). Changes only the look.
 * @param {THREE.BufferGeometry} geometry a geometry built with a tone map
 */
export function applyAlbedoStrength(geometry, strength) {
  const data = geometry.userData.albedo;
  if (!data) return;
  const colors = geometry.attributes.color.array;
  const s = Math.max(strength, 0);
  for (let i = 0; i < data.base.length; i++) {
    const f = Math.max(1 + (data.factor[i] - 1) * s, 0.3);
    const grey = Math.min(data.base[i] * f, 1);
    colors[i * 3] = grey;
    colors[i * 3 + 1] = grey * 0.995;
    colors[i * 3 + 2] = Math.min(1, grey * 1.012);
  }
  geometry.attributes.color.needsUpdate = true;
}

/** Evenly spaced sample indices from a0 to a1 inclusive; the last step is shorter if `stride` does not divide the span. */
function axisSamples(a0, a1, stride) {
  const out = [];
  for (let v = a0; v < a1; v += stride) out.push(v);
  out.push(a1);
  return out;
}

/**
 * Triangle mesh of a rectangle of the height map (rows r0..r1, columns c0..c1) in scene
 * coordinates (x east, y up, z south), sampled every `stride` cells.
 *
 * Normals come straight from the height differences (the same gradient that gives the slope
 * shade), so neighbouring pieces with different strides still shade alike. With `skirtM > 0` a
 * vertical skirt of that depth hangs from the four borders: where two pieces of different detail
 * meet, their edges differ by a metre or two and the skirt hides the crack.
 * @param {import('./terrainData.js').Terrain} terrain
 * @param {{r0: number, r1: number, c0: number, c1: number}} box
 * @param {number} [stride]
 * @param {Uint8Array|null} [albedo] the site's LROC tone map (one byte per terrain cell)
 * @param {{skirtM?: number, albedoStrength?: number}} [options]
 */
export function buildChunkGeometry(terrain, box, stride = 1, albedo = null, { skirtM = 0, albedoStrength = ALBEDO_STRENGTH } = {}) {
  const { rows, cols, heights, pixelM, minM, maxM } = terrain;
  const rowList = axisSamples(box.r0, box.r1, stride);
  const colList = axisSamples(box.c0, box.c1, stride);
  const nr = rowList.length;
  const nc = colList.length;
  const gridCount = nr * nc;
  const skirtCount = skirtM > 0 ? 2 * (nr + nc) : 0;
  const total = gridCount + skirtCount;
  const positions = new Float32Array(total * 3);
  const normals = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const uvs = new Float32Array(total * 2);
  const hasAlbedo = Boolean(albedo) && albedo.length === rows * cols;
  const baseGrey = hasAlbedo ? new Float32Array(total) : null;
  const factor = hasAlbedo ? new Float32Array(total) : null;

  const beta = (terrain.northBearingDeg * Math.PI) / 180;
  const cosB = Math.cos(beta);
  const sinB = Math.sin(beta);
  const [obsR, obsC] = terrain.observerRc;

  for (let i = 0; i < nr; i++) {
    const r = rowList[i];
    const up = (obsR - r) * pixelM;
    const rm = Math.max(r - 1, 0);
    const rp = Math.min(r + 1, rows - 1);
    for (let j = 0; j < nc; j++) {
      const c = colList[j];
      const right = (c - obsC) * pixelM;
      const v = i * nc + j;
      const k = v * 3;
      const x = right * cosB - up * sinB;
      const z = -(up * cosB + right * sinB);
      const h = heights[r * cols + c];
      positions[k] = x;
      positions[k + 1] = h;
      positions[k + 2] = z;

      // gradient from the neighbouring cells (one-sided at the border), per metre
      const cm = Math.max(c - 1, 0);
      const cp = Math.min(c + 1, cols - 1);
      const hx = (heights[r * cols + cp] - heights[r * cols + cm]) / ((cp - cm) * pixelM);
      const hy = (heights[rp * cols + c] - heights[rm * cols + c]) / ((rp - rm) * pixelM);
      const length = Math.sqrt(hx * hx + hy * hy + 1);
      const nRight = -hx / length;
      const nUp = hy / length;
      normals[k] = nRight * cosB - nUp * sinB;
      normals[k + 1] = 1 / length;
      normals[k + 2] = -(nUp * cosB + nRight * sinB);

      const slopeDeg = (Math.atan(Math.hypot(hx, hy)) * 180) / Math.PI;
      const grey = terrainColor(h, minM, maxM, r, c, slopeDeg);
      colors[k] = grey;
      colors[k + 1] = grey * 0.995;
      colors[k + 2] = Math.min(1, grey * 1.012);
      uvs[v * 2] = x / REGOLITH_TILE_M;
      uvs[v * 2 + 1] = z / REGOLITH_TILE_M;
      if (hasAlbedo) {
        baseGrey[v] = grey;
        factor[v] = albedoFactor(albedo[r * cols + c]);
      }
    }
  }

  // skirt vertices: copies of the border vertices, dropped by skirtM (top, bottom, left, right sides)
  const skirt = { top: [], bottom: [], left: [], right: [] };
  if (skirtCount) {
    let next = gridCount;
    const copyDown = (source) => {
      const v = next++;
      positions.set(positions.subarray(source * 3, source * 3 + 3), v * 3);
      positions[v * 3 + 1] -= skirtM;
      normals.set(normals.subarray(source * 3, source * 3 + 3), v * 3);
      colors.set(colors.subarray(source * 3, source * 3 + 3), v * 3);
      uvs.set(uvs.subarray(source * 2, source * 2 + 2), v * 2);
      if (hasAlbedo) {
        baseGrey[v] = baseGrey[source];
        factor[v] = factor[source];
      }
      return v;
    };
    for (let j = 0; j < nc; j++) skirt.top.push([j, copyDown(j)]);
    for (let j = 0; j < nc; j++) skirt.bottom.push([(nr - 1) * nc + j, copyDown((nr - 1) * nc + j)]);
    for (let i = 0; i < nr; i++) skirt.left.push([i * nc, copyDown(i * nc)]);
    for (let i = 0; i < nr; i++) skirt.right.push([i * nc + nc - 1, copyDown(i * nc + nc - 1)]);
  }

  const quads = (nr - 1) * (nc - 1);
  const skirtQuads = skirtCount ? 2 * (nr - 1) + 2 * (nc - 1) : 0;
  const indexCount = (quads + skirtQuads) * 6;
  const indices = total > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  let n = 0;
  for (let i = 0; i < nr - 1; i++) {
    for (let j = 0; j < nc - 1; j++) {
      const a = i * nc + j; // (r, c)
      const b = (i + 1) * nc + j; // (r + 1, c)
      const c = i * nc + j + 1; // (r, c + 1)
      const d = (i + 1) * nc + j + 1; // (r + 1, c + 1)
      indices[n++] = a; // counter-clockwise seen from above
      indices[n++] = b;
      indices[n++] = c;
      indices[n++] = b;
      indices[n++] = d;
      indices[n++] = c;
    }
  }
  // each skirt quad faces outwards from the piece it hangs from
  const wall = (side, flip) => {
    for (let s = 0; s < side.length - 1; s++) {
      const [a, ad] = side[s];
      const [b, bd] = side[s + 1];
      if (!flip) indices.set([a, b, ad, b, bd, ad], n);
      else indices.set([b, a, bd, a, ad, bd], n);
      n += 6;
    }
  };
  if (skirtCount) {
    wall(skirt.top, false);
    wall(skirt.bottom, true);
    wall(skirt.left, true);
    wall(skirt.right, false);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  if (hasAlbedo) {
    geometry.userData.albedo = { base: baseGrey, factor };
    applyAlbedoStrength(geometry, albedoStrength);
  }
  return geometry;
}

/**
 * Triangle mesh of the whole height map in scene coordinates (x east, y up, z south).
 * `stride` thins the grid (2 -> one vertex every 10 m for a 5 m DEM).
 * `albedo`, if given, is the site's LROC tone map (one byte per terrain cell); the vertices are
 * then tinted by it (see applyAlbedoStrength).
 * @param {import('./terrainData.js').Terrain} terrain
 * @param {number} [stride]
 * @param {Uint8Array|null} [albedo]
 */
export function buildTerrainGeometry(terrain, stride = 2, albedo = null) {
  return buildChunkGeometry(terrain, { r0: 0, r1: terrain.rows - 1, c0: 0, c1: terrain.cols - 1 }, stride, albedo);
}
