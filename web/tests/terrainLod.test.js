import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import {
  BUILD_BUDGET,
  CHUNK_CELLS,
  LOD_DISTANCES,
  LOD_SKIRT_M,
  LOD_STRIDES,
  chooseLod,
  createTerrainLod,
} from '../src/scene/terrainLod.js';
import { buildChunkGeometry, buildTerrainGeometry } from '../src/scene/terrainMesh.js';
import { loadTinyTerrain, makeTerrain } from './helpers.js';

const material = new THREE.MeshBasicMaterial();
const tiny = loadTinyTerrain();

/** A 1.5 km square of rolling hills, big enough for 5 x 5 chunks. */
const hills = makeTerrain({
  rows: 301,
  cols: 301,
  observerRc: [150, 150],
  height: (r, c) => 40 * Math.sin(r / 23) * Math.cos(c / 31) + 0.05 * r,
});

describe('chooseLod', () => {
  test('picks the level by distance, 0 being the finest', () => {
    expect(chooseLod(0)).toBe(0);
    expect(chooseLod(LOD_DISTANCES[0] - 1)).toBe(0);
    expect(chooseLod(LOD_DISTANCES[0])).toBe(1);
    expect(chooseLod(LOD_DISTANCES[1])).toBe(2);
    expect(chooseLod(LOD_DISTANCES[2])).toBe(3);
    expect(chooseLod(1e6)).toBe(LOD_STRIDES.length - 1);
  });

  test('has hysteresis: a chunk on a boundary does not flicker between two levels', () => {
    const edge = LOD_DISTANCES[0];
    expect(chooseLod(edge + 5, 0)).toBe(0); // slightly past the boundary: stays fine
    expect(chooseLod(edge * 1.2, 0)).toBe(1); // clearly past it: goes coarser
    expect(chooseLod(edge - 5, 1)).toBe(1); // slightly inside: stays coarse
    expect(chooseLod(edge * 0.8, 1)).toBe(0); // clearly inside: goes finer
  });

  test('can skip several levels at once when the camera jumps', () => {
    expect(chooseLod(5000, 0)).toBe(LOD_STRIDES.length - 1);
    expect(chooseLod(10, 3)).toBe(0);
  });

  test('levels get coarser and the skirts deeper', () => {
    for (let i = 1; i < LOD_STRIDES.length; i++) {
      expect(LOD_STRIDES[i]).toBeGreaterThan(LOD_STRIDES[i - 1]);
      expect(LOD_SKIRT_M[i]).toBeGreaterThan(LOD_SKIRT_M[i - 1]);
    }
    for (const s of LOD_STRIDES) expect(CHUNK_CELLS % s).toBe(0); // every level divides a full chunk
  });
});

describe('buildChunkGeometry', () => {
  test('the pieces of the terrain tile it exactly: shared borders have identical vertices', () => {
    const left = buildChunkGeometry(hills, { r0: 0, r1: 64, c0: 0, c1: 64 }, 1);
    const right = buildChunkGeometry(hills, { r0: 0, r1: 64, c0: 64, c1: 128 }, 1);
    const nc = 65;
    for (let r = 0; r <= 64; r++) {
      const a = r * nc + 64; // last column of the left piece
      const b = r * nc; // first column of the right piece
      for (const axis of ['getX', 'getY', 'getZ']) expect(left.attributes.position[axis](a)).toBeCloseTo(right.attributes.position[axis](b), 5);
      for (const axis of ['getX', 'getY', 'getZ']) expect(left.attributes.normal[axis](a)).toBeCloseTo(right.attributes.normal[axis](b), 6);
    }
  });

  test('analytic normals agree with the normals of the mesh itself on smooth ground', () => {
    const analytic = buildTerrainGeometry(hills, 1);
    const reference = analytic.clone();
    reference.computeVertexNormals();
    const nc = 301;
    let worst = 0;
    for (let r = 2; r < 299; r += 7) {
      for (let c = 2; c < 299; c += 7) {
        const i = r * nc + c;
        const a = new THREE.Vector3(analytic.attributes.normal.getX(i), analytic.attributes.normal.getY(i), analytic.attributes.normal.getZ(i));
        const b = new THREE.Vector3(reference.attributes.normal.getX(i), reference.attributes.normal.getY(i), reference.attributes.normal.getZ(i));
        worst = Math.max(worst, a.angleTo(b));
      }
    }
    expect(worst).toBeLessThan(0.03); // under 2 degrees
  });

  test('normals are unit length and point up, including with a rotated grid', () => {
    const rotated = makeTerrain({ rows: 21, cols: 21, observerRc: [10, 10], northBearingDeg: 137, height: (r, c) => 0.3 * c + 0.1 * r });
    const g = buildTerrainGeometry(rotated, 1);
    const n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) {
      expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 5);
      expect(n.getY(i)).toBeGreaterThan(0);
    }
    // the surface rises towards the grid's east (+c): the normal leans away from it
    const centre = 10 * 21 + 10;
    const east = new THREE.Vector3(Math.cos((137 * Math.PI) / 180), 0, -Math.sin((137 * Math.PI) / 180)); // grid "right" in scene axes
    expect(east.x * n.getX(centre) + east.z * n.getZ(centre)).toBeLessThan(0);
  });

  test('a skirt hangs below each border and faces outwards', () => {
    const flat = makeTerrain({ rows: 9, cols: 9, observerRc: [4, 4], height: () => 100 });
    const depth = 10;
    const g = buildChunkGeometry(flat, { r0: 0, r1: 8, c0: 0, c1: 8 }, 2, null, { skirtM: depth });
    const nr = 5;
    const grid = nr * nr;
    expect(g.attributes.position.count).toBe(grid + 4 * nr);
    expect(g.index.count).toBe((4 * 4 + 4 * 4) * 6);
    // skirt vertices are the border ones, dropped by the depth
    for (let v = grid; v < g.attributes.position.count; v++) expect(g.attributes.position.getY(v)).toBeCloseTo(100 - depth, 5);
    // every skirt triangle's normal is horizontal and points away from the centre of the piece
    const pos = g.attributes.position;
    const idx = g.index.array;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let t = 16 * 6; t < idx.length; t += 3) {
      a.fromBufferAttribute(pos, idx[t]);
      b.fromBufferAttribute(pos, idx[t + 1]);
      c.fromBufferAttribute(pos, idx[t + 2]);
      const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
      expect(Math.abs(normal.y)).toBeLessThan(1e-6);
      const centroid = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3);
      expect(normal.x * centroid.x + normal.z * centroid.z).toBeGreaterThan(0);
    }
  });

  test('the skirt is deep enough to cover the crack between two levels of detail', () => {
    const edgeHeight = (stride, r, c0, c1) => {
      const g = buildChunkGeometry(hills, { r0: 0, r1: 64, c0, c1 }, stride, null);
      return (col) => g.attributes.position.getY(r * ((c1 - c0) / stride + 1) + (col - c0) / stride);
    };
    // along the south edge of the first chunk (row 64) compare the finest and the coarsest level
    const fine = buildChunkGeometry(hills, { r0: 0, r1: 64, c0: 0, c1: 64 }, 1);
    const coarse = buildChunkGeometry(hills, { r0: 0, r1: 64, c0: 0, c1: 64 }, 8);
    const sample = (g, stride, col) => {
      const per = 64 / stride + 1;
      const k = col / stride;
      const lo = Math.floor(k);
      const hi = Math.min(lo + 1, per - 1);
      const row = 64 / stride;
      const f = k - lo;
      return g.attributes.position.getY(row * per + lo) * (1 - f) + g.attributes.position.getY(row * per + hi) * f;
    };
    let worst = 0;
    for (let col = 0; col <= 64; col++) worst = Math.max(worst, Math.abs(sample(fine, 1, col) - sample(coarse, 8, col)));
    expect(worst).toBeLessThanOrEqual(LOD_SKIRT_M[3]);
    expect(edgeHeight).toBeDefined();
  });

  test('uses 16-bit indices for a chunk and 32-bit ones for a very large piece', () => {
    const chunk = buildChunkGeometry(hills, { r0: 0, r1: 64, c0: 0, c1: 64 }, 1, null, { skirtM: 3 });
    expect(chunk.index.array).toBeInstanceOf(Uint16Array);
    expect(buildTerrainGeometry(hills, 1).index.array).toBeInstanceOf(Uint32Array);
  });
});

describe('createTerrainLod', () => {
  const full = 2 * 300 * 300; // triangles of the whole map at the finest level

  test('splits the map into chunks and starts them all at the coarsest level', () => {
    const lod = createTerrainLod(hills, { material });
    const stats = lod.stats();
    expect(stats.chunks).toBe(Math.ceil(300 / CHUNK_CELLS) ** 2);
    expect(stats.levels[LOD_STRIDES.length - 1]).toBe(stats.chunks);
    expect(stats.built).toBe(stats.chunks);
    expect(lod.group.children).toHaveLength(stats.chunks);
    expect(stats.triangles).toBeLessThan(full / 20);
  });

  test('the camera decides: near chunks are finest, far ones stay coarse, far fewer triangles than the full mesh', () => {
    const lod = createTerrainLod(hills, { material });
    const changed = lod.update(new THREE.Vector3(0, 60, 0), Infinity);
    expect(changed).toBe(true);
    const { levels, triangles } = lod.stats();
    expect(levels[0]).toBeGreaterThan(0);
    expect(levels[LOD_STRIDES.length - 1]).toBeLessThan(lod.stats().chunks);
    expect(triangles).toBeLessThan(full * 0.6); // a 1.5 km map: most chunks are still within the middle levels
    // the chunk under the camera is the finest
    const under = lod.chunks.find(({ box }) => box.r0 <= 150 && box.r1 >= 150 && box.c0 <= 150 && box.c1 >= 150);
    expect(under.lod).toBe(0);
  });

  test('builds at most `budget` geometries per update and finishes over the next ones', () => {
    const lod = createTerrainLod(hills, { material });
    const before = lod.stats().built;
    lod.update(new THREE.Vector3(0, 60, 0), 2);
    expect(lod.stats().built - before).toBe(2);
    let calls = 0;
    while (lod.update(new THREE.Vector3(0, 60, 0), 2) && calls < 50) calls++;
    expect(calls).toBeGreaterThan(0);
    expect(BUILD_BUDGET).toBeGreaterThan(0);
    // settled: another update changes nothing
    expect(lod.update(new THREE.Vector3(0, 60, 0), Infinity)).toBe(false);
  });

  test('a geometry that was built is reused when the camera comes back', () => {
    const lod = createTerrainLod(hills, { material });
    lod.update(new THREE.Vector3(0, 60, 0), Infinity);
    const built = lod.stats().built;
    lod.update(new THREE.Vector3(5000, 60, 5000), Infinity);
    lod.update(new THREE.Vector3(0, 60, 0), Infinity);
    expect(lod.stats().built).toBeGreaterThanOrEqual(built);
    const again = lod.stats().built;
    lod.update(new THREE.Vector3(5000, 60, 5000), Infinity);
    lod.update(new THREE.Vector3(0, 60, 0), Infinity);
    expect(lod.stats().built).toBe(again); // nothing new to build on the second round trip
  });

  test('each mesh has a bounding sphere that contains all its vertices, at every level', () => {
    const lod = createTerrainLod(hills, { material });
    lod.update(new THREE.Vector3(0, 60, 0), Infinity);
    for (const chunk of lod.chunks) {
      for (const geometry of chunk.geometries) {
        if (!geometry) continue;
        const p = geometry.attributes.position;
        const v = new THREE.Vector3();
        for (let i = 0; i < p.count; i += 7) {
          v.fromBufferAttribute(p, i);
          expect(chunk.sphere.distanceToPoint(v)).toBeLessThanOrEqual(1e-3);
        }
      }
    }
  });

  test('chunks cast and receive shadows and share one material', () => {
    const lod = createTerrainLod(hills, { material });
    for (const mesh of lod.group.children) {
      expect(mesh.castShadow).toBe(true);
      expect(mesh.receiveShadow).toBe(true);
      expect(mesh.material).toBe(material);
    }
  });

  test('works on a terrain smaller than one chunk and on one that is not a multiple of the chunk size', () => {
    const lod = createTerrainLod(tiny, { material }); // 101 x 101 -> 2 x 2 chunks of 64 and 36 cells
    expect(lod.stats().chunks).toBe(4);
    lod.update(new THREE.Vector3(0, 100, 0), Infinity);
    expect(lod.stats().levels[0]).toBeGreaterThan(0);
    const small = createTerrainLod(makeTerrain({ rows: 20, cols: 20, observerRc: [10, 10], height: () => 0 }), { material });
    expect(small.stats().chunks).toBe(1);
  });

  test('setAlbedoStrength recolours built geometries and applies to ones built later', () => {
    const { cols } = tiny;
    const tones = new Uint8Array(tiny.rows * cols).fill(100);
    tones[50 * cols + 50] = 160;
    const lod = createTerrainLod(tiny, { albedo: tones, material, albedoStrength: 1 });
    lod.update(new THREE.Vector3(0, 100, 0), Infinity);
    const chunk = lod.chunks.find(({ box }) => box.r0 === 0 && box.c0 === 0);
    const at = () => chunk.mesh.geometry.attributes.color.array[(50 * 65 + 50) * 3];
    const bright = at();
    lod.setAlbedoStrength(0);
    expect(at()).toBeLessThan(bright);
    lod.setAlbedoStrength(1);
    expect(at()).toBeCloseTo(bright, 6);
    lod.setAlbedoStrength(0);
    lod.update(new THREE.Vector3(5000, 100, 0), Infinity); // everything goes coarse...
    lod.update(new THREE.Vector3(0, 100, 0), Infinity); // ...and back: still untinted
    expect(at()).toBeLessThan(bright);
  });

  test('dispose frees every geometry that was ever built', () => {
    const lod = createTerrainLod(hills, { material });
    lod.update(new THREE.Vector3(0, 60, 0), Infinity);
    let disposed = 0;
    for (const chunk of lod.chunks) for (const geometry of chunk.geometries) geometry?.addEventListener('dispose', () => disposed++);
    const built = lod.stats().built;
    lod.dispose();
    expect(disposed).toBe(built);
  });
});
