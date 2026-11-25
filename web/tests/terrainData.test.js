// @vitest-environment node
import { describe, expect, test } from 'vitest';
import {
  contains,
  gridToScene,
  heightAt,
  normalAt,
  parseTerrain,
  sceneToGrid,
  slopeDegAt,
} from '../src/scene/terrainData.js';
import { loadTinyTerrain, makeTerrain } from './helpers.js';

const tiny = loadTinyTerrain();

describe('heightAt', () => {
  test('reads the ramp and the cliff of the tiny terrain', () => {
    expect(heightAt(tiny, 0, 0)).toBeCloseTo(10, 3);
    expect(heightAt(tiny, 10, 0)).toBeCloseTo(10.4, 3);
    expect(heightAt(tiny, 0, 200)).toBeCloseTo(40, 3);
  });

  test('is NaN outside the terrain', () => {
    expect(heightAt(tiny, 1000, 0)).toBeNaN();
    expect(contains(tiny, 1000, 0)).toBe(false);
    expect(contains(tiny, 0, 0)).toBe(true);
  });

  test('respects north_bearing_deg: with 90 the grid +c axis is true north', () => {
    const t = makeTerrain({ rows: 101, cols: 101, observerRc: [50, 50], northBearingDeg: 90, height: (r, c) => 0.2 * c });
    expect(heightAt(t, 0, -10)).toBeCloseTo(10.4, 3); // 10 m north
    expect(heightAt(t, 10, 0)).toBeCloseTo(10, 3); // 10 m east is along grid -r: flat
  });
});

describe('slopeDegAt', () => {
  test('gentle on the ramp, very steep at the cliff, infinite at the edge', () => {
    expect(slopeDegAt(tiny, 0, 0)).toBeCloseTo(2.29, 1);
    expect(slopeDegAt(tiny, 0, 195)).toBeGreaterThan(60);
    expect(slopeDegAt(tiny, 249, 0)).toBe(Infinity);
  });
});

describe('normalAt', () => {
  test('leans away from the uphill (east) direction and points up', () => {
    const n = normalAt(tiny, 0, 0);
    expect(n.x).toBeLessThan(0);
    expect(n.y).toBeGreaterThan(0);
    expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 9);
  });
});

describe('coordinate conversion', () => {
  test('scene -> grid -> scene round-trips with the real bearing of Site 01 (222.5 deg)', () => {
    const t = makeTerrain({ rows: 1001, cols: 1001, observerRc: [500.3, 499.7], northBearingDeg: 222.5, height: () => 0 });
    for (const [r, c] of [[0, 0], [250.5, 700.25], [1000, 1000], [500.3, 499.7]]) {
      const { x, z } = gridToScene(t, r, c);
      const back = sceneToGrid(t, x, z);
      expect(back.r).toBeCloseTo(r, 6);
      expect(back.c).toBeCloseTo(c, 6);
    }
    const origin = gridToScene(t, 500.3, 499.7);
    expect(origin.x).toBeCloseTo(0, 9);
    expect(origin.z).toBeCloseTo(0, 9);
  });

  test('a point one pixel along grid "up" lies at azimuth (-bearing) from true north', () => {
    const t = makeTerrain({ rows: 101, cols: 101, observerRc: [50, 50], northBearingDeg: 90, height: () => 0 });
    // grid up = true azimuth -90 = west: x < 0, z ~ 0
    const { x, z } = gridToScene(t, 49, 50);
    expect(x).toBeCloseTo(-5, 6);
    expect(z).toBeCloseTo(0, 6);
  });
});

describe('parseTerrain', () => {
  test('a buffer of the wrong size throws and mentions the expected size', () => {
    const meta = { rows: 3, cols: 4, pixel_m: 5, min_m: 0, max_m: 1, observer_rc: [1, 1], north_bearing_deg: 0 };
    expect(() => parseTerrain(new ArrayBuffer(10), meta)).toThrow('24');
  });
});
