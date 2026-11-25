// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { createPlayer, advanceTime } from '../src/panel/player.js';
import { timelineData } from '../src/panel/timelineData.js';
import { DEFAULT_THRESHOLDS } from '../src/metrics/scenario.js';
import { createStore } from '../src/state.js';
import { HOUR, T0, loadTinySite } from './helpers.js';

const site = loadTinySite();

describe('timelineData', () => {
  const data = timelineData(site, T0, T0 + 47 * HOUR);

  test('has time, sun elevation, sun horizon, earth elevation, earth horizon', () => {
    expect(data).toHaveLength(5);
    for (const series of data) expect(series).toHaveLength(48);
    expect(data[0][0]).toBe(T0 / 1000);
    expect(data[0][47]).toBe((T0 + 47 * HOUR) / 1000);
  });

  test('horizon series is evaluated in each body direction', () => {
    expect(data[1][3]).toBeCloseTo(2.1213, 3);
    expect(Array.from(data[2]).every((v) => v === 2)).toBe(true); // sun azimuth 90 -> ridge
    expect(Array.from(data[4]).every((v) => Math.abs(v + 0.1) < 1e-6)).toBe(true); // earth azimuth 180
  });

  test('a range outside the data throws RangeError', () => {
    expect(() => timelineData(site, Date.UTC(2031, 0, 1), Date.UTC(2031, 0, 2))).toThrow(RangeError);
  });
});

describe('advanceTime', () => {
  test('adds the simulated step', () => {
    expect(advanceTime(site.eph, T0 + HOUR, 5 * HOUR)).toEqual({ timeMs: T0 + 6 * HOUR, ended: false });
  });

  test('stops at the end of the data and reports it', () => {
    expect(advanceTime(site.eph, T0 + 40 * HOUR, 100 * HOUR)).toEqual({ timeMs: T0 + 47 * HOUR, ended: true });
  });
});

describe('createPlayer', () => {
  function setup(extra = {}) {
    const store = createStore({
      scenarios: { A: { siteId: 'tiny-site', timeMs: T0 }, B: null },
      windowMs: 24 * HOUR,
      thresholds: { ...DEFAULT_THRESHOLDS },
      playing: false,
      locale: 'es',
      ...extra,
    });
    let pending = null;
    const frames = {
      raf: (cb) => ((pending = cb), 1),
      caf: () => (pending = null),
      step(ts) {
        const cb = pending;
        pending = null;
        if (cb) cb(ts);
      },
    };
    const sites = new Map([['tiny-site', site]]);
    const player = createPlayer(store, sites, HOUR, { raf: frames.raf, caf: frames.caf });
    return { store, frames, player };
  }

  test('advances the scenario by speed x elapsed time', () => {
    const { store, frames, player } = setup();
    player.start();
    expect(store.get().playing).toBe(true);
    frames.step(0);
    frames.step(100);
    expect(store.get().scenarios.A.timeMs).toBeCloseTo(T0 + 0.1 * HOUR, 3);
  });

  test('a long gap between frames (hidden tab) advances at most 100 ms worth of time', () => {
    const { store, frames, player } = setup();
    player.start();
    frames.step(0);
    frames.step(600_000); // ten real minutes later
    expect(store.get().scenarios.A.timeMs).toBeCloseTo(T0 + 0.1 * HOUR, 3);
    expect(store.get().playing).toBe(true);
  });

  test('stops by itself at the end of the data', () => {
    const { store, frames, player } = setup();
    player.start();
    frames.step(0);
    for (let ts = 100; ts <= 60_000 && store.get().playing; ts += 100) frames.step(ts);
    expect(store.get().scenarios.A.timeMs).toBe(T0 + 47 * HOUR);
    expect(store.get().playing).toBe(false);
  });

  test('changing the site stops the animation', () => {
    const { store, frames, player } = setup();
    player.start();
    frames.step(0);
    store.set({ scenarios: { A: { siteId: 'other', timeMs: T0 }, B: null } });
    expect(store.get().playing).toBe(false);
    frames.step(1000);
    expect(store.get().scenarios.A.timeMs).toBe(T0);
  });

  test('advances scenario B together with A', () => {
    const { store, frames, player } = setup({
      scenarios: { A: { siteId: 'tiny-site', timeMs: T0 }, B: { siteId: 'tiny-site', timeMs: T0 + 10 * HOUR } },
    });
    player.start();
    frames.step(0);
    frames.step(100);
    expect(store.get().scenarios.A.timeMs).toBeCloseTo(T0 + 0.1 * HOUR, 3);
    expect(store.get().scenarios.B.timeMs).toBeCloseTo(T0 + 10.1 * HOUR, 3);
  });
});
