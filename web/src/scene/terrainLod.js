import * as THREE from 'three';
import { ALBEDO_STRENGTH, applyAlbedoStrength, buildChunkGeometry } from './terrainMesh.js';

/** Cells along each side of a chunk (64 cells = 320 m at 5 m per cell). */
export const CHUNK_CELLS = 64;
/** Grid stride of each level of detail: 5 m, 10 m, 20 m and 40 m between vertices. */
export const LOD_STRIDES = [1, 2, 4, 8];
/** A chunk drops to the next level when it is further than this from the camera (metres, from its nearest point). */
export const LOD_DISTANCES = [260, 640, 1500];
/** Depth (metres) of the skirt that hides the cracks between levels, per level. */
export const LOD_SKIRT_M = [3, 6, 12, 24];
/** How many chunk geometries may be built in one update; the rest wait for the next frame. */
export const BUILD_BUDGET = 6;
const HYSTERESIS = 0.1;

/**
 * Level of detail for a chunk at `distance` metres. With `current`, the change is delayed until the
 * distance is a tenth past the boundary, so a chunk sitting on it does not flicker between levels.
 * @param {number} distance
 * @param {number|null} [current]
 */
export function chooseLod(distance, current = null) {
  const last = LOD_STRIDES.length - 1;
  if (current === null) {
    let lod = 0;
    while (lod < last && distance >= LOD_DISTANCES[lod]) lod++;
    return lod;
  }
  let lod = current;
  while (lod < last && distance > LOD_DISTANCES[lod] * (1 + HYSTERESIS)) lod++;
  while (lod > 0 && distance < LOD_DISTANCES[lod - 1] * (1 - HYSTERESIS)) lod--;
  return lod;
}

/** Lowest and highest height among the cells of a box, sampled every other cell (and the last one). */
function heightRange(terrain, { r0, r1, c0, c1 }) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let r = r0; r <= r1; r += r === r1 ? 1 : Math.min(2, r1 - r)) {
    for (let c = c0; c <= c1; c += c === c1 ? 1 : Math.min(2, c1 - c)) {
      const h = terrain.heights[r * terrain.cols + c];
      if (h < lo) lo = h;
      if (h > hi) hi = h;
    }
  }
  return { lo, hi };
}

/**
 * The terrain as a grid of chunks, each drawn at a level of detail that depends on its distance to
 * the camera (the full 5 m mesh would be 2 million triangles every frame). All chunks start at the
 * coarsest level; finer geometry is built the first time a chunk needs it and then kept. Chunks
 * outside the view are skipped by the renderer's frustum culling.
 * @param {import('./terrainData.js').Terrain} terrain
 * @param {{albedo?: Uint8Array|null, material: THREE.Material, albedoStrength?: number}} options
 */
export function createTerrainLod(terrain, { albedo = null, material, albedoStrength = ALBEDO_STRENGTH }) {
  const group = new THREE.Group();
  group.name = 'terrain';
  let strength = albedoStrength;
  const chunks = [];
  const coarsest = LOD_STRIDES.length - 1;

  const beta = (terrain.northBearingDeg * Math.PI) / 180;
  const cosB = Math.cos(beta);
  const sinB = Math.sin(beta);
  const [obsR, obsC] = terrain.observerRc;
  const toScene = (r, c) => {
    const right = (c - obsC) * terrain.pixelM;
    const up = (obsR - r) * terrain.pixelM;
    return [right * cosB - up * sinB, -(up * cosB + right * sinB)];
  };

  function build(chunk, lod) {
    const geometry = buildChunkGeometry(terrain, chunk.box, LOD_STRIDES[lod], albedo, {
      skirtM: LOD_SKIRT_M[lod],
      albedoStrength: strength,
    });
    geometry.boundingSphere = chunk.sphere.clone();
    chunk.geometries[lod] = geometry;
    return geometry;
  }

  for (let r0 = 0; r0 < terrain.rows - 1; r0 += CHUNK_CELLS) {
    for (let c0 = 0; c0 < terrain.cols - 1; c0 += CHUNK_CELLS) {
      const box = { r0, r1: Math.min(r0 + CHUNK_CELLS, terrain.rows - 1), c0, c1: Math.min(c0 + CHUNK_CELLS, terrain.cols - 1) };
      // bounding sphere from the four corners and the height range (padded by the deepest skirt)
      const corners = [toScene(box.r0, box.c0), toScene(box.r0, box.c1), toScene(box.r1, box.c0), toScene(box.r1, box.c1)];
      const xs = corners.map((p) => p[0]);
      const zs = corners.map((p) => p[1]);
      const { lo, hi } = heightRange(terrain, box);
      const center = new THREE.Vector3(
        (Math.min(...xs) + Math.max(...xs)) / 2,
        (lo + hi) / 2 - LOD_SKIRT_M[coarsest] / 2,
        (Math.min(...zs) + Math.max(...zs)) / 2,
      );
      const half = new THREE.Vector3(
        (Math.max(...xs) - Math.min(...xs)) / 2,
        (hi - lo) / 2 + LOD_SKIRT_M[coarsest] / 2,
        (Math.max(...zs) - Math.min(...zs)) / 2,
      );
      const chunk = { box, sphere: new THREE.Sphere(center, half.length()), geometries: [], lod: coarsest, mesh: null };
      chunk.mesh = new THREE.Mesh(build(chunk, coarsest), material);
      chunk.mesh.castShadow = true;
      chunk.mesh.receiveShadow = true;
      chunk.mesh.name = `terrain-${r0}-${c0}`;
      group.add(chunk.mesh);
      chunks.push(chunk);
    }
  }

  /**
   * Choose each chunk's level for a camera at `position` and swap in its geometry, building it first
   * if it does not exist yet (at most `budget` builds; chunks that did not fit keep their current level).
   * @returns {boolean} whether any chunk changed level, so a cached shadow map needs redrawing
   */
  function update(position, budget = BUILD_BUDGET) {
    let changed = false;
    let left = budget;
    for (const chunk of chunks) {
      const distance = Math.max(0, position.distanceTo(chunk.sphere.center) - chunk.sphere.radius);
      const wanted = chooseLod(distance, chunk.lod);
      if (wanted === chunk.lod) continue;
      let geometry = chunk.geometries[wanted];
      if (!geometry) {
        if (left <= 0) continue;
        left--;
        geometry = build(chunk, wanted);
      }
      chunk.mesh.geometry = geometry;
      chunk.lod = wanted;
      changed = true;
    }
    return changed;
  }

  /** Show (or hide, with 0) the LROC tone variation, on every geometry built so far and on the ones built later. */
  function setAlbedoStrength(value) {
    strength = value;
    for (const chunk of chunks) for (const geometry of chunk.geometries) if (geometry) applyAlbedoStrength(geometry, value);
  }

  function dispose() {
    for (const chunk of chunks) for (const geometry of chunk.geometries) geometry?.dispose();
  }

  /** How many chunks are at each level, and how many geometries exist (for tests and the debug handle). */
  function stats() {
    const levels = new Array(LOD_STRIDES.length).fill(0);
    let built = 0;
    let triangles = 0;
    for (const chunk of chunks) {
      levels[chunk.lod]++;
      triangles += chunk.mesh.geometry.index.count / 3;
      for (const geometry of chunk.geometries) if (geometry) built++;
    }
    return { chunks: chunks.length, levels, built, triangles };
  }

  return { group, update, setAlbedoStrength, dispose, stats, chunks };
}
