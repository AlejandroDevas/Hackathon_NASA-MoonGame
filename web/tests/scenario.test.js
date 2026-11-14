import { describe, expect, test } from 'vitest';
import { DEFAULT_THRESHOLDS, evaluateScenario, viability } from '../src/metrics/scenario.js';
import { HOUR, T0, loadTinySite } from './helpers.js';

const site = loadTinySite();
const hours = (ms) => ms / HOUR;

describe('evaluateScenario (tiny site, t = 5 h, 24 h window)', () => {
  const m = evaluateScenario(site, T0 + 5 * HOUR, 24 * HOUR);

  test('instantaneous values', () => {
    expect(m.sunElDeg).toBeCloseTo(2.898, 3);
    expect(m.earthElDeg).toBe(5);
    expect(m.sunVisible).toBe(true);
    expect(m.earthVisible).toBe(true);
    expect(m.nextSun.kind).toBe('set');
    expect(m.nextEarth.kind).toBe('set');
  });

  test('window metrics', () => {
    expect(m.sunFraction).toBeCloseTo(0.30203, 3);
    expect(m.earthFraction).toBeCloseTo(0.69583, 3);
    expect(hours(m.longestDarkMs)).toBeCloseTo(16.75132, 3);
    expect(hours(m.longestEarthGapMs)).toBeCloseTo(7.3, 3);
    expect(m.earthWindows).toHaveLength(2);
    expect(m.truncated).toBe(false);
  });

  test('a window past the end of the data is clipped and flagged', () => {
    const long = evaluateScenario(site, T0 + 5 * HOUR, 100 * HOUR);
    expect(long.truncated).toBe(true);
    expect(long.windowEndMs).toBe(T0 + 47 * HOUR);
  });

  test('a time outside the data throws RangeError', () => {
    expect(() => evaluateScenario(site, Date.UTC(2031, 0, 1), 24 * HOUR)).toThrow(RangeError);
  });
});

describe('viability', () => {
  const m = evaluateScenario(site, T0 + 5 * HOUR, 24 * HOUR);

  test('default thresholds', () => {
    expect(DEFAULT_THRESHOLDS).toEqual({ minSunElDeg: 0, maxDarkH: 120, maxEarthGapH: 48 });
  });

  test('all checks pass -> green', () => {
    expect(viability(m)).toEqual({ level: 'green', failed: [] });
  });

  test('one failure -> amber, two or more -> red', () => {
    const amber = viability(m, { ...DEFAULT_THRESHOLDS, maxDarkH: 10 });
    expect(amber).toEqual({ level: 'amber', failed: ['dark'] });
    const red = viability(m, { ...DEFAULT_THRESHOLDS, maxDarkH: 10, maxEarthGapH: 5 });
    expect(red).toEqual({ level: 'red', failed: ['dark', 'earthGap'] });
  });

  test('sun below the minimum elevation fails the sunEl check', () => {
    const result = viability(m, { ...DEFAULT_THRESHOLDS, minSunElDeg: 5 });
    expect(result.failed).toEqual(['sunEl']);
  });
});

describe('polar day and night windows', () => {
  test('a window in permanent darkness reports the whole window as dark', async () => {
    const { makeSite } = await import('./helpers.js');
    const night = makeSite({ sunEl: new Array(48).fill(-1) });
    const m = evaluateScenario(night, T0 + 5 * HOUR, 24 * HOUR);
    expect(m.sunFraction).toBe(0);
    expect(m.sunVisible).toBe(false);
    expect(m.nextSun).toBeNull();
    expect(hours(m.longestDarkMs)).toBeCloseTo(24, 6);
  });
});
