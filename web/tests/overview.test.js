import { describe, expect, test } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../src/metrics/scenario.js';
import { bestWindows, lightCalendar, litStart, siteOverview } from '../src/metrics/overview.js';
import { HOUR, T0, makeSite } from './helpers.js';

/** 48 hours: the Sun is up (5 deg over a flat 0 deg horizon) for the first 24 and down after. */
function daySite() {
  const sunEl = Array.from({ length: 48 }, (_, i) => (i < 24 ? 5 : -5));
  const earthEl = Array.from({ length: 48 }, (_, i) => (i >= 12 && i < 36 ? 3 : -3));
  return makeSite({ sunEl, earthEl });
}

describe('siteOverview', () => {
  test('covers the whole dataset and is cached', () => {
    const site = daySite();
    const overview = siteOverview(site);
    expect(overview.fromMs).toBe(T0);
    expect(overview.toMs).toBe(T0 + 47 * HOUR);
    expect(overview.sunFraction).toBeGreaterThan(0.45);
    expect(overview.sunFraction).toBeLessThan(0.55);
    expect(overview.longestSunMs).toBeGreaterThan(22 * HOUR);
    expect(overview.longestDarkMs).toBeGreaterThan(22 * HOUR);
    expect(siteOverview(site)).toBe(overview);
  });
});

describe('bestWindows', () => {
  test('returns the sunniest non-overlapping windows, in time order', () => {
    const windows = bestWindows(daySite(), { stayMs: 12 * HOUR, count: 2 });
    expect(windows).toHaveLength(2);
    expect(windows[0].startMs).toBe(T0);
    expect(windows[1].startMs).toBe(T0 + 12 * HOUR);
    for (const w of windows) {
      expect(w.sunFraction).toBe(1);
      expect(w.endMs - w.startMs).toBe(12 * HOUR);
    }
  });

  test('prefers the window where Earth is also visible when the Sun ties', () => {
    const [best] = bestWindows(daySite(), { stayMs: 6 * HOUR, count: 1 });
    // Sun is up for hours 0..23 and Earth for 12..35: the best 6 h window starts at hour 12..18
    expect(best.sunFraction).toBe(1);
    expect(best.earthFraction).toBe(1);
    expect(best.startMs).toBeGreaterThanOrEqual(T0 + 12 * HOUR);
    expect(best.startMs).toBeLessThanOrEqual(T0 + 18 * HOUR);
  });

  test('attaches the scenario metrics and, when asked, the verdict', () => {
    const [w] = bestWindows(daySite(), { stayMs: 12 * HOUR, count: 1, thresholds: DEFAULT_THRESHOLDS });
    expect(w.metrics.sunFraction).toBeCloseTo(1, 1);
    expect(w.verdict.level).toBeDefined();
    expect(bestWindows(daySite(), { stayMs: 12 * HOUR, count: 1 })[0].verdict).toBeNull();
  });

  test('is empty when the stay does not fit in the data', () => {
    expect(bestWindows(daySite(), { stayMs: 100 * HOUR })).toEqual([]);
  });

  test('respects the from/to limits', () => {
    const windows = bestWindows(daySite(), { stayMs: 6 * HOUR, fromMs: T0 + 30 * HOUR, count: 3 });
    for (const w of windows) expect(w.startMs).toBeGreaterThanOrEqual(T0 + 30 * HOUR);
  });
});

describe('lightCalendar', () => {
  test('marks every hour of every day, and no-data cells beyond the data', () => {
    const calendar = lightCalendar(daySite(), T0, 3);
    expect(calendar.days).toBe(3);
    expect(calendar.sun).toHaveLength(72);
    expect(calendar.sun[0]).toBe(1);
    expect(calendar.sun[23]).toBe(1);
    expect(calendar.sun[24]).toBe(0);
    expect(calendar.sun[47]).toBe(0);
    expect(calendar.sun[48]).toBe(2); // day 3 is past the 48 hours of data
    expect(calendar.earth[12]).toBe(1);
    expect(calendar.earth[0]).toBe(0);
  });
});

describe('litStart', () => {
  test('starts at the first hour of the sunniest window, with the Sun and the Earth up', () => {
    // Sun up for hours 0..23, Earth for 12..35: a 6 h stay is fully lit and in contact from hour 12 on
    const start = litStart(daySite(), { stayMs: 6 * HOUR });
    expect(start).toBeGreaterThanOrEqual(T0 + 12 * HOUR);
    expect(start).toBeLessThanOrEqual(T0 + 18 * HOUR);
  });

  test('stays inside the requested range', () => {
    const start = litStart(daySite(), { stayMs: 6 * HOUR, fromMs: T0 + 24 * HOUR });
    expect(start).toBeGreaterThanOrEqual(T0 + 24 * HOUR);
  });

  test('returns null when the range is too short for the stay', () => {
    expect(litStart(daySite(), { stayMs: 100 * HOUR })).toBeNull();
  });
});
