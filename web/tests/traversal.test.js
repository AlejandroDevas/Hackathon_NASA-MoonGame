// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { ROUTE_MARGIN_DEG, SLOPE_LADDER_DEG, findStart, planStart } from '../src/scene/traversal.js';
import { parseTerrain } from '../src/scene/terrainData.js';
import { loadTinyTerrain, makeTerrain } from './helpers.js';

const tiny = loadTinyTerrain();
const here = dirname(fileURLToPath(import.meta.url));

describe('findStart (tiny terrain)', () => {
  test('returns a reachable point near the target distance, never beyond the cliff', () => {
    const start = findStart(tiny, { x: 0, z: 0 }, 200);
    expect(start).not.toBeNull();
    expect(Math.abs(start.distanceM - 200)).toBeLessThanOrEqual(15);
    expect(start.z).toBeLessThan(198); // the area south of the cliff is not connected to the goal
    expect(Math.hypot(start.x, start.z)).toBeCloseTo(start.distanceM, 6);
  });

  test('the heading points at the goal', () => {
    const { x, z, headingDeg, distanceM } = findStart(tiny, { x: 0, z: 0 }, 200);
    const h = (headingDeg * Math.PI) / 180;
    // heading 0 = north (-z), 90 = east (+x); the goal is the origin
    expect(Math.sin(h)).toBeCloseTo(-x / distanceM, 3);
    expect(Math.cos(h)).toBeCloseTo(z / distanceM, 3);
    expect(headingDeg).toBeGreaterThanOrEqual(0);
    expect(headingDeg).toBeLessThan(360);
  });

  test('a goal outside the terrain has no start', () => {
    expect(findStart(tiny, { x: 1000, z: 0 }, 200)).toBeNull();
  });
});

describe('findStart limit and margin', () => {
  const fourteen = makeTerrain({ rows: 101, cols: 101, observerRc: [50, 50], height: (r, c) => 1.25 * c }); // ~14 degrees

  test('limitDeg 15 admits a 14 degree slope; a 2 degree route margin does not', () => {
    expect(findStart(fourteen, { x: 0, z: 0 }, 150, { limitDeg: 15 })).not.toBeNull();
    expect(findStart(fourteen, { x: 0, z: 0 }, 150, { limitDeg: 15, marginDeg: 2 })).toBeNull();
  });

  test('the route goes from the start point to the goal area', () => {
    const start = findStart(tiny, { x: 0, z: 0 }, 200);
    expect(start.route.length).toBeGreaterThan(5);
    expect(start.route[0]).toEqual({ x: start.x, z: start.z });
    const last = start.route[start.route.length - 1];
    expect(Math.hypot(last.x, last.z)).toBeLessThanOrEqual(20);
  });
});

describe('findStart route edges', () => {
  // flat except a 30 m wall exactly on row 72 (z = 110 m): the nodes at z = 100 and z = 120 (stride 20 m)
  // are not affected by it, only the points between them are
  const wall = makeTerrain({
    rows: 101,
    cols: 101,
    observerRc: [50, 50],
    height: (r) => (r === 72 ? 30 : 0),
  });

  test('a steep strip between two walkable nodes cuts the route (edges are sampled, not just nodes)', () => {
    const start = findStart(wall, { x: 0, z: 0 }, 200, { limitDeg: 15, marginDeg: 2, strideM: 20 });
    expect(start).not.toBeNull();
    for (const node of start.route) expect(node.z).toBeLessThan(110); // nothing beyond the wall is reachable
    expect(start.z).toBeLessThan(110);
  });
});

describe('planStart (per-site slope limit)', () => {
  test('a start that is nowhere near the target distance does not count as winnable', () => {
    // flat terrain boxed in by a 40 degree ring 60 m from the goal: only a 60 m pocket is reachable
    const pocket = makeTerrain({
      rows: 201,
      cols: 201,
      observerRc: [100, 100],
      height: (r, c) => (Math.hypot(r - 100, c - 100) * 5 > 60 ? 8 * Math.hypot(r - 100, c - 100) : 0),
    });
    expect(planStart(pocket, { x: 0, z: 0 }, 400).reachable).toBe(false);
  });

  const ramp = (perPixel) => makeTerrain({ rows: 101, cols: 101, observerRc: [50, 50], height: (r, c) => perPixel * c });

  test('gentle terrain gets the lowest limit of the ladder (15) and a route', () => {
    const plan = planStart(tiny, { x: 0, z: 0 }, 200);
    expect(plan.reachable).toBe(true);
    expect(plan.limitDeg).toBe(15);
    expect(plan.route[0]).toEqual({ x: plan.x, z: plan.z });
    expect(Math.abs(plan.distanceM - 200)).toBeLessThanOrEqual(15);
  });

  test('terrain of about 32 degrees everywhere needs a 35 degree limit', () => {
    const plan = planStart(ramp(3.1), { x: 0, z: 0 }, 200);
    expect(plan.reachable).toBe(true);
    expect(plan.limitDeg).toBe(35);
  });

  test('terrain steeper than the whole ladder reports no route instead of failing silently', () => {
    const plan = planStart(ramp(6), { x: 0, z: 0 }, 200); // ~50 degrees
    expect(plan).toEqual({ x: 0, z: 0, headingDeg: 0, distanceM: 0, route: [], limitDeg: 45, reachable: false });
  });

  test('the ladder constants match the design', () => {
    expect(SLOPE_LADDER_DEG).toEqual([15, 20, 25, 30, 35, 40, 45]);
    expect(ROUTE_MARGIN_DEG).toBe(2);
  });
});

describe('findStart (real Site 01 terrain)', () => {
  test('the sign can be reached from about 400 m away within the 25 degree limit', () => {
    const dir = join(here, '..', 'public', 'sites', 'site01-connecting-ridge');
    const info = JSON.parse(readFileSync(join(dir, 'info.json'), 'utf8'));
    const bytes = readFileSync(join(dir, info.terrain.file));
    const terrain = parseTerrain(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), info.terrain);

    const start = findStart(terrain, { x: 0, z: 0 }, 400);
    expect(start).not.toBeNull();
    expect(Math.abs(start.distanceM - 400)).toBeLessThanOrEqual(40);
  }, 30_000); // a 1001x1001 BFS with edge sampling takes a few seconds when the machine is busy
});
