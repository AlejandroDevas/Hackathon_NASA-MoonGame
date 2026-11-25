// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { horizonAt, indexAt, marginSeries } from '../src/metrics/visibility.js';
import { HOUR, T0, loadTinySite } from './helpers.js';

describe('horizonAt', () => {
  const h = new Float32Array(360);
  h[359] = 1;
  h[0] = 3;

  test('interpolates across the 359 -> 0 seam', () => {
    expect(horizonAt(h, 359.5)).toBeCloseTo(2, 6);
    expect(horizonAt(h, 360)).toBe(3);
    expect(horizonAt(h, -0.5)).toBeCloseTo(2, 6);
  });

  test('returns the sample at an integer azimuth', () => {
    const ridge = new Float32Array(360).fill(-0.1);
    ridge[90] = 2;
    expect(horizonAt(ridge, 90)).toBe(2);
  });
});

describe('indexAt', () => {
  const { eph } = loadTinySite();

  test('maps time to a fractional sample index', () => {
    expect(indexAt(eph, T0 + 5 * HOUR)).toBe(5);
    expect(indexAt(eph, T0 + 5.5 * HOUR)).toBeCloseTo(5.5, 9);
    expect(indexAt(eph, T0 + 47 * HOUR)).toBe(47);
  });

  test('throws a RangeError outside the data (e.g. 2031)', () => {
    expect(() => indexAt(eph, Date.UTC(2031, 0, 1))).toThrow(RangeError);
    expect(() => indexAt(eph, T0 - HOUR)).toThrow(RangeError);
  });
});

describe('marginSeries', () => {
  const site = loadTinySite();

  test('sun margin = elevation + radius - horizon in its direction', () => {
    const sun = marginSeries(site, 'sun');
    expect(sun[2]).toBeCloseTo(-0.2334, 3);
    expect(sun[3]).toBeCloseTo(0.3879, 3);
  });

  test('earth margin uses its own azimuth and radius', () => {
    const earth = marginSeries(site, 'earth');
    expect(earth[12]).toBeCloseTo(-0.9, 5);
    expect(earth[0]).toBeCloseTo(5.1, 5);
  });
});
