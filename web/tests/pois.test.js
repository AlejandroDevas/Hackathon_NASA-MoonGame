import { describe, expect, test } from 'vitest';
import { compassKey, findPois, relativeTo } from '../src/scene/pois.js';
import { gridToScene } from '../src/scene/terrainData.js';
import { makeTerrain } from './helpers.js';

const ROWS = 101;
const COLS = 101;

function bump({ high, low }) {
  return makeTerrain({
    rows: ROWS,
    cols: COLS,
    observerRc: [50, 50],
    height: (r, c) => {
      if (high && r === high[0] && c === high[1]) return 500;
      if (low && r === low[0] && c === low[1]) return -200;
      return 0;
    },
  });
}

describe('findPois', () => {
  test('always starts with the site sign at the origin', () => {
    const pois = findPois(bump({ high: [20, 80], low: [80, 20] }));
    expect(pois[0]).toMatchObject({ id: 'goal', x: 0, z: 0 });
  });

  test('finds the highest and lowest points at their scene coordinates', () => {
    const terrain = bump({ high: [20, 80], low: [80, 20] });
    const pois = findPois(terrain);
    const high = pois.find((p) => p.id === 'high');
    const low = pois.find((p) => p.id === 'low');
    expect(high.heightM).toBe(500);
    expect(low.heightM).toBe(-200);
    const expectedHigh = gridToScene(terrain, 20, 80);
    expect(high.x).toBeCloseTo(expectedHigh.x);
    expect(high.z).toBeCloseTo(expectedHigh.z);
  });

  test('ignores the border, where edge pixels are unreliable', () => {
    const pois = findPois(bump({ high: [2, 2], low: [97, 97] }));
    expect(pois.map((p) => p.id)).toEqual(['goal']);
  });

  test('does not repeat a landmark right next to the sign', () => {
    const pois = findPois(bump({ high: [50, 52], low: [80, 20] }));
    expect(pois.map((p) => p.id)).toEqual(['goal', 'low']);
  });

  test('a flat map has only the site sign', () => {
    expect(findPois(bump({})).map((p) => p.id)).toEqual(['goal']);
  });
});

describe('relativeTo / compassKey', () => {
  test('distance and bearing follow the scene axes (north = -z, east = +x)', () => {
    expect(relativeTo({ x: 0, z: -100 }, { x: 0, z: 0 })).toMatchObject({ distanceM: 100, bearingDeg: 0, compass: 'N' });
    expect(relativeTo({ x: 100, z: 0 }, { x: 0, z: 0 })).toMatchObject({ bearingDeg: 90, compass: 'E' });
    expect(relativeTo({ x: 0, z: 100 }, { x: 0, z: 0 }).compass).toBe('S');
    expect(relativeTo({ x: -30, z: 30 }, { x: 0, z: 0 }).compass).toBe('SW');
  });

  test('wraps around north', () => {
    expect(compassKey(359)).toBe('N');
    expect(compassKey(-10)).toBe('N');
    expect(compassKey(44)).toBe('NE');
  });
});
