// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createStore } from '../src/state.js';
import { DEFAULT_SPEED_MS, SKIPS, SPEEDS, createPlayback } from '../src/ui/playback.js';
import { HOUR, T0, loadTinySite } from './helpers.js';

const site = loadTinySite();
const sites = new Map([['tiny-site', site]]);
const LAST = T0 + 47 * HOUR;

function setup(scenarios) {
  const store = createStore({ scenarios, playing: false });
  return { store, playback: createPlayback(store, sites) };
}
const only = (timeMs) => ({ A: { siteId: 'tiny-site', timeMs }, B: null });
const both = (a, b) => ({ A: { siteId: 'tiny-site', timeMs: a }, B: { siteId: 'tiny-site', timeMs: b } });

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => vi.unstubAllGlobals());

describe('createPlayback', () => {
  test('the speeds go from one hour per second up to a month, and the default is in the list', () => {
    expect(SPEEDS.map((s) => s.ms)).toEqual([3_600_000, 6 * 3_600_000, 86_400_000, 7 * 86_400_000, 30 * 86_400_000]);
    expect(SPEEDS.some((s) => s.ms === DEFAULT_SPEED_MS)).toBe(true);
    expect(SKIPS).toEqual({ hour: 3_600_000, day: 86_400_000 });
  });

  test('shiftBy moves scenario A, and scenario B by the same amount, each stopping at its own ends', () => {
    const { store, playback } = setup(both(T0 + 5 * HOUR, T0 + 45 * HOUR));
    playback.shiftBy(3 * HOUR);
    expect(store.get().scenarios.A.timeMs).toBe(T0 + 8 * HOUR);
    expect(store.get().scenarios.B.timeMs).toBe(LAST); // 48 h would pass the end of the data: clamped
    playback.shiftBy(-100 * HOUR);
    expect(store.get().scenarios.A.timeMs).toBe(T0);
    expect(store.get().scenarios.B.timeMs).toBe(T0);
  });

  test('seekTo jumps A to the moment and keeps the gap to B', () => {
    const { store, playback } = setup(both(T0 + 5 * HOUR, T0 + 15 * HOUR));
    playback.seekTo(T0 + 20 * HOUR);
    expect(store.get().scenarios.A.timeMs).toBe(T0 + 20 * HOUR);
    expect(store.get().scenarios.B.timeMs).toBe(T0 + 30 * HOUR);
  });

  test('seekTo clamps to the calculated range and does nothing when already there', () => {
    const { store, playback } = setup(only(T0 + 5 * HOUR));
    playback.seekTo(Date.UTC(2031, 0, 1));
    expect(store.get().scenarios.A.timeMs).toBe(LAST);
    playback.seekTo(Date.UTC(2020, 0, 1));
    expect(store.get().scenarios.A.timeMs).toBe(T0);
    const listener = vi.fn();
    store.subscribe(listener);
    playback.seekTo(T0);
    expect(listener).not.toHaveBeenCalled();
  });

  test('play starts the animation and pause stops it; toggle alternates', () => {
    const { store, playback } = setup(only(T0 + 5 * HOUR));
    playback.play();
    expect(store.get().playing).toBe(true);
    playback.pause();
    expect(store.get().playing).toBe(false);
    playback.toggle();
    expect(store.get().playing).toBe(true);
    playback.toggle();
    expect(store.get().playing).toBe(false);
  });

  test('playing from the end of the data starts again from the beginning, as a video does', () => {
    const { store, playback } = setup(both(LAST, LAST));
    playback.play();
    expect(store.get().scenarios.A.timeMs).toBe(T0);
    expect(store.get().playing).toBe(true);
  });

  test('pausing something that is not playing is harmless', () => {
    const { store, playback } = setup(only(T0));
    expect(() => playback.pause()).not.toThrow();
    expect(store.get().playing).toBe(false);
  });

  test('the speed changes only to one of the known speeds', () => {
    const { playback } = setup(only(T0));
    expect(playback.speedMs).toBe(DEFAULT_SPEED_MS);
    playback.setSpeed(SPEEDS[2].ms);
    expect(playback.speedMs).toBe(SPEEDS[2].ms);
    playback.setSpeed(12345);
    expect(playback.speedMs).toBe(SPEEDS[2].ms);
  });

  test('a running animation continues at the new speed, a paused one stays paused', () => {
    // animation frames that can really be cancelled, like the browser's
    let nextId = 0;
    const pending = new Map();
    vi.stubGlobal('requestAnimationFrame', (cb) => {
      pending.set(++nextId, cb);
      return nextId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id) => pending.delete(id));
    const runFrame = (timestamp) => {
      const [id, cb] = pending.entries().next().value;
      pending.delete(id);
      cb(timestamp);
    };

    const { store, playback } = setup(only(T0));
    playback.setSpeed(SPEEDS[0].ms);
    playback.play();
    runFrame(1000); // the first frame sets the clock
    runFrame(1100); // 100 ms of real time at one hour per second = 6 minutes
    expect(store.get().scenarios.A.timeMs - T0).toBeCloseTo(0.1 * HOUR, -3);
    const before = store.get().scenarios.A.timeMs;
    playback.setSpeed(SPEEDS[2].ms);
    expect(store.get().playing).toBe(true);
    expect(pending.size).toBe(1); // the old loop was cancelled, only the new one is waiting
    runFrame(2000);
    runFrame(2100);
    expect(store.get().scenarios.A.timeMs - before).toBeCloseTo(2.4 * HOUR, -4); // 100 ms at one day per second
    playback.pause();
    expect(pending.size).toBe(0);
    playback.setSpeed(SPEEDS[0].ms);
    expect(store.get().playing).toBe(false);
    expect(pending.size).toBe(0);
  });
});
