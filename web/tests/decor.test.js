// @vitest-environment node
import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { glowPixels } from '../src/scene/glow.js';
import { buildLander, footingAt } from '../src/scene/lander.js';
import { SHADOW_MIN_SCALE, buildRocks, placeRocks } from '../src/scene/rocks.js';
import { heightAt, slopeDegAt } from '../src/scene/terrainData.js';
import { makeTerrain } from './helpers.js';

const flat = makeTerrain({ rows: 301, cols: 301, observerRc: [150, 150], height: () => 100 });
// a 45 degree wall on the east side (x > 300 m), flat elsewhere
const wall = makeTerrain({ rows: 301, cols: 301, observerRc: [150, 150], height: (r, c) => 100 + Math.max(0, c - 210) * 5 });
// a tilted plane, rising 0.4 m per metre to the east
const tilted = makeTerrain({ rows: 301, cols: 301, observerRc: [150, 150], height: (r, c) => 100 + c * 2 });

describe('placeRocks', () => {
  test('is deterministic and places the requested scatter plus patches', () => {
    const options = { scatter: 200, patches: [{ x: 0, z: 0, radiusM: 50, count: 40 }] };
    const a = placeRocks(flat, options);
    const b = placeRocks(flat, options);
    expect(a).toEqual(b);
    expect(a).toHaveLength(240);
    expect(placeRocks(flat, { ...options, seed: 1 })).not.toEqual(a);
  });

  test('rocks sit on the terrain and stay inside the map', () => {
    for (const rock of placeRocks(flat, { scatter: 300 })) {
      expect(Math.abs(rock.x)).toBeLessThan(750);
      expect(Math.abs(rock.z)).toBeLessThan(750);
      expect(rock.y).toBeLessThanOrEqual(100);
      expect(rock.y).toBeGreaterThan(95);
      expect(rock.scale).toBeGreaterThan(0.2);
      expect(rock.scale).toBeLessThanOrEqual(4.2);
    }
  });

  test('avoids steep ground', () => {
    const rocks = placeRocks(wall, { scatter: 500 });
    expect(rocks.length).toBeGreaterThan(0);
    for (const rock of rocks) expect(slopeDegAt(wall, rock.x, rock.z)).toBeLessThanOrEqual(28);
  });

  test('keeps the cleared zones free', () => {
    const rocks = placeRocks(flat, {
      scatter: 400,
      patches: [{ x: 0, z: 0, radiusM: 60, count: 100 }],
      keepClear: [{ x: 0, z: 0, radiusM: 20 }],
    });
    for (const rock of rocks) expect(Math.hypot(rock.x, rock.z)).toBeGreaterThan(20);
  });

  test('most rocks are small and a few are boulders', () => {
    const rocks = placeRocks(flat, { scatter: 800 });
    const small = rocks.filter((r) => r.scale < 1).length;
    const big = rocks.filter((r) => r.scale > 2).length;
    expect(small / rocks.length).toBeGreaterThan(0.6);
    expect(big).toBeGreaterThan(0);
    expect(big / rocks.length).toBeLessThan(0.1);
  });
});

describe('buildRocks', () => {
  test('instanced meshes per shape and size class holding every placement; only large rocks cast shadows', () => {
    const placements = placeRocks(flat, { scatter: 400 });
    const group = buildRocks(placements);
    const total = group.children.reduce((sum, mesh) => sum + mesh.count, 0);
    expect(total).toBe(400);
    expect(group.children.length).toBeLessThanOrEqual(6);
    let large = 0;
    for (const mesh of group.children) {
      expect(mesh.isInstancedMesh).toBe(true);
      expect(mesh.receiveShadow).toBe(true);
      expect(mesh.instanceColor).not.toBeNull();
      expect(mesh.castShadow).toBe(mesh.name.endsWith('-large'));
      if (mesh.castShadow) large += mesh.count;
    }
    expect(large).toBe(placements.filter((p) => p.scale >= SHADOW_MIN_SCALE).length);
    expect(large).toBeLessThan(total * 0.4); // the shadow pass draws a minority of the rocks
  });
});

describe('lander', () => {
  test('footing: on flat ground every foot is at the same level', () => {
    const { base, feet } = footingAt(flat, 0, 0);
    expect(base).toBeCloseTo(100);
    for (const f of feet) expect(f.dy).toBeCloseTo(0);
    expect(feet).toHaveLength(4);
  });

  test('footing: on a slope the base is the lowest foot and the others are higher', () => {
    const { base, feet } = footingAt(tilted, 0, 0);
    expect(base).toBeLessThan(heightAt(tilted, 0, 0));
    expect(Math.max(...feet.map((f) => f.dy))).toBeGreaterThan(1.5); // 0.4 m per m over ~4.8 m between feet
    expect(Math.min(...feet.map((f) => f.dy))).toBeCloseTo(0);
  });

  test('the model stands on its footpads: nothing below the lowest foot, and legs reach the high feet', () => {
    const { feet } = footingAt(tilted, 0, 0);
    const lander = buildLander(feet);
    const box = new THREE.Box3().setFromObject(lander);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.05);
    expect(box.min.y).toBeLessThan(0.3);
    // the body clears the highest foot
    const highest = Math.max(...feet.map((f) => f.dy));
    const stage = lander.children[0];
    expect(stage.position.y).toBeGreaterThan(highest + 1);
    // a few metres wide and tall, like a small lander, not a speck or a skyscraper
    const size = box.getSize(new THREE.Vector3());
    expect(Math.max(size.x, size.z)).toBeGreaterThan(6);
    expect(Math.max(size.x, size.z)).toBeLessThan(14);
    expect(size.y).toBeGreaterThan(5);
  });

  test('every mesh casts and receives shadows', () => {
    const lander = buildLander(footingAt(flat, 0, 0).feet);
    let meshes = 0;
    lander.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      expect(o.castShadow).toBe(true);
      expect(o.receiveShadow).toBe(true);
    });
    expect(meshes).toBeGreaterThan(15);
  });
});

describe('sun glow', () => {
  test('is opaque white-ish at the centre and fades to nothing at the edge', () => {
    const size = 33;
    const pixels = glowPixels(size);
    const at = (x, y) => pixels[(y * size + x) * 4 + 3];
    expect(at(16, 16)).toBe(255);
    expect(at(0, 16)).toBe(0);
    expect(at(8, 16)).toBeGreaterThan(at(4, 16));
  });
});
