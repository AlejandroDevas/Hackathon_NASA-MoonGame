// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { nextTransition, visibilityWindows } from '../src/metrics/events.js';
import { HOUR, T0, loadTinySite, makeSite } from './helpers.js';

const site = loadTinySite();
const at = (hours) => T0 + hours * HOUR;
const expectHours = (ms, hours) => expect(Math.abs((ms - T0) / HOUR - hours)).toBeLessThan(0.001);

describe('nextTransition', () => {
  test('sun visible at 5 h sets at ~9.62434 h', () => {
    const t = nextTransition(site, 'sun', at(5));
    expect(t.kind).toBe('set');
    expectHours(t.atMs, 9.62434);
  });

  test('sun down at 12 h rises at ~26.37566 h', () => {
    const t = nextTransition(site, 'sun', at(12));
    expect(t.kind).toBe('rise');
    expectHours(t.atMs, 26.37566);
  });

  test('earth visible at 5 h sets at 11.85 h; hidden at 15 h rises at 19.15 h', () => {
    const set = nextTransition(site, 'earth', at(5));
    expect(set.kind).toBe('set');
    expectHours(set.atMs, 11.85);
    const rise = nextTransition(site, 'earth', at(15));
    expect(rise.kind).toBe('rise');
    expectHours(rise.atMs, 19.15);
  });

  test('polar day and polar night have no next transition', () => {
    const day = makeSite({ sunEl: new Array(48).fill(1) });
    const night = makeSite({ sunEl: new Array(48).fill(-1) });
    expect(nextTransition(day, 'sun', at(5))).toBeNull();
    expect(nextTransition(night, 'sun', at(5))).toBeNull();
  });

  test('a time outside the data throws RangeError', () => {
    expect(() => nextTransition(site, 'sun', Date.UTC(2031, 0, 1))).toThrow(RangeError);
  });
});

describe('visibilityWindows', () => {
  test('earth between 5 h and 29 h has two windows', () => {
    const w = visibilityWindows(site, 'earth', at(5), at(29));
    expect(w).toHaveLength(2);
    expectHours(w[0].startMs, 5);
    expectHours(w[0].endMs, 11.85);
    expectHours(w[1].startMs, 19.15);
    expectHours(w[1].endMs, 29);
  });

  test('polar day is one window covering the request; polar night is none', () => {
    const day = makeSite({ sunEl: new Array(48).fill(1) });
    const night = makeSite({ sunEl: new Array(48).fill(-1) });
    const w = visibilityWindows(day, 'sun', at(5), at(29));
    expect(w).toEqual([{ startMs: at(5), endMs: at(29) }]);
    expect(visibilityWindows(night, 'sun', at(5), at(29))).toEqual([]);
  });

  test('a request running past the data end is clipped, never extended', () => {
    const w = visibilityWindows(site, 'earth', at(40), at(60));
    expect(w).toHaveLength(1);
    expectHours(w[0].startMs, 40);
    expect(w[0].endMs).toBe(at(47));
  });
});
