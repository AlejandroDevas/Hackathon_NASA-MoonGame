import * as THREE from 'three';
import { gridToScene } from './terrainData.js';

/**
 * Triangle mesh of the height map in scene coordinates (x east, y up, z south).
 * `stride` thins the grid (2 -> one vertex every 10 m for a 5 m DEM).
 * @param {import('./terrainData.js').Terrain} terrain
 */
export function buildTerrainGeometry(terrain, stride = 2) {
  const nr = Math.floor((terrain.rows - 1) / stride) + 1;
  const nc = Math.floor((terrain.cols - 1) / stride) + 1;
  const positions = new Float32Array(nr * nc * 3);
  for (let i = 0; i < nr; i++) {
    for (let j = 0; j < nc; j++) {
      const r = i * stride;
      const c = j * stride;
      const { x, z } = gridToScene(terrain, r, c);
      const k = (i * nc + j) * 3;
      positions[k] = x;
      positions[k + 1] = terrain.heights[r * terrain.cols + c];
      positions[k + 2] = z;
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
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}
