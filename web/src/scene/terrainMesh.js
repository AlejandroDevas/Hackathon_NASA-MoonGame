import * as THREE from 'three';
import { gridToScene } from './terrainData.js';

function hash2D(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * Brightness factor (0.5..1) of a terrain vertex: lighter higher up, plus a very
 * subtle deterministic grain. It only affects the look; the geometry stays the LOLA height map.
 */
export function terrainColor(heightM, minM, maxM, r, c) {
  const span = maxM - minM;
  const elevNorm = span > 0 ? Math.min(Math.max((heightM - minM) / span, 0), 1) : 0.5;
  const grain = (hash2D(r * 0.71, c * 0.71) - 0.5) * 0.06;
  return Math.min(Math.max(0.62 + elevNorm * 0.34 + grain, 0.5), 1);
}

/**
 * Triangle mesh of the height map in scene coordinates (x east, y up, z south).
 * `stride` thins the grid (2 -> one vertex every 10 m for a 5 m DEM).
 * @param {import('./terrainData.js').Terrain} terrain
 */
export function buildTerrainGeometry(terrain, stride = 2) {
  const nr = Math.floor((terrain.rows - 1) / stride) + 1;
  const nc = Math.floor((terrain.cols - 1) / stride) + 1;
  const positions = new Float32Array(nr * nc * 3);
  const colors = new Float32Array(nr * nc * 3);
  for (let i = 0; i < nr; i++) {
    for (let j = 0; j < nc; j++) {
      const r = i * stride;
      const c = j * stride;
      const { x, z } = gridToScene(terrain, r, c);
      const k = (i * nc + j) * 3;
      positions[k] = x;
      positions[k + 1] = terrain.heights[r * terrain.cols + c];
      positions[k + 2] = z;
      const grey = terrainColor(terrain.heights[r * terrain.cols + c], terrain.minM, terrain.maxM, r, c);
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
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}
