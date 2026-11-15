import * as THREE from 'three';
import { REGOLITH_TILE_M } from './regolith.js';
import { gridToScene } from './terrainData.js';

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

/**
 * Triangle mesh of the height map in scene coordinates (x east, y up, z south).
 * `stride` thins the grid (2 -> one vertex every 10 m for a 5 m DEM).
 * `albedo`, if given, is the site's LROC tone map (one byte per terrain cell); the vertices are
 * then tinted by it (see applyAlbedoStrength).
 * @param {import('./terrainData.js').Terrain} terrain
 * @param {number} [stride]
 * @param {Uint8Array|null} [albedo]
 */
export function buildTerrainGeometry(terrain, stride = 2, albedo = null) {
  const nr = Math.floor((terrain.rows - 1) / stride) + 1;
  const nc = Math.floor((terrain.cols - 1) / stride) + 1;
  const positions = new Float32Array(nr * nc * 3);
  const colors = new Float32Array(nr * nc * 3);
  const uvs = new Float32Array(nr * nc * 2);
  const { rows, cols, heights, pixelM } = terrain;
  const hasAlbedo = albedo && albedo.length === rows * cols;
  const baseGrey = hasAlbedo ? new Float32Array(nr * nc) : null;
  const factor = hasAlbedo ? new Float32Array(nr * nc) : null;
  for (let i = 0; i < nr; i++) {
    for (let j = 0; j < nc; j++) {
      const r = i * stride;
      const c = j * stride;
      const { x, z } = gridToScene(terrain, r, c);
      const k = (i * nc + j) * 3;
      positions[k] = x;
      positions[k + 1] = terrain.heights[r * terrain.cols + c];
      positions[k + 2] = z;
      // slope from the central difference of the neighbouring cells (clamped at the border)
      const hx = (heights[r * cols + Math.min(c + 1, cols - 1)] - heights[r * cols + Math.max(c - 1, 0)]) / (2 * pixelM);
      const hy = (heights[Math.min(r + 1, rows - 1) * cols + c] - heights[Math.max(r - 1, 0) * cols + c]) / (2 * pixelM);
      const slopeDeg = (Math.atan(Math.hypot(hx, hy)) * 180) / Math.PI;
      const grey = terrainColor(heights[r * cols + c], terrain.minM, terrain.maxM, r, c, slopeDeg);
      uvs[(i * nc + j) * 2] = x / REGOLITH_TILE_M;
      uvs[(i * nc + j) * 2 + 1] = z / REGOLITH_TILE_M;
      if (hasAlbedo) {
        baseGrey[i * nc + j] = grey;
        factor[i * nc + j] = albedoFactor(albedo[r * cols + c]);
      }
      colors[k] = grey;
      colors[k + 1] = grey * 0.995;
      colors[k + 2] = Math.min(1, grey * 1.012);
    }
  }

  const indices = new Uint32Array((nr - 1) * (nc - 1) * 6);
  let n = 0;
  for (let i = 0; i < nr - 1; i++) {
    for (let j = 0; j < nc - 1; j++) {
      const a = i * nc + j; // (r, c)
      const b = (i + 1) * nc + j; // (r + 1, c)
      const c = i * nc + j + 1; // (r, c + 1)
      const d = (i + 1) * nc + j + 1; // (r + 1, c + 1)
      indices.set([a, b, c, b, d, c], n); // counter-clockwise seen from above
      n += 6;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  if (hasAlbedo) {
    geometry.userData.albedo = { base: baseGrey, factor };
    applyAlbedoStrength(geometry, ALBEDO_STRENGTH);
  }
  return geometry;
}
