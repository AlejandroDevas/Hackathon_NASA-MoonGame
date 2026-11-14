import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { findStart, planStart } from '../src/scene/traversal.js';
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

describe('planStart', () => {
  test('on walkable terrain it is findStart plus reachable: true', () => {
    const plan = planStart(tiny, { x: 0, z: 0 }, 200);
    expect(plan.reachable).toBe(true);
    expect(Math.abs(plan.distanceM - 200)).toBeLessThanOrEqual(15);
  });

  test('on terrain steeper than the limit everywhere it reports no route instead of failing silently', () => {
    const steep = makeTerrain({ rows: 101, cols: 101, observerRc: [50, 50], height: (r, c) => 4.2 * c }); // ~40 degrees
    expect(findStart(steep, { x: 0, z: 0 }, 200)).toBeNull();
    expect(planStart(steep, { x: 0, z: 0 }, 200)).toEqual({ x: 0, z: 0, headingDeg: 0, distanceM: 0, reachable: false });
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
  });
});
