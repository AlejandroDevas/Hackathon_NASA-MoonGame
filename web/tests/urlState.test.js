// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createStore } from '../src/state.js';
import { buildUrlSearch, formatUrlTime, parseUrlState, startUrlSync } from '../src/urlState.js';

const SITES = ['haworth', 'site01'];
const T = Date.UTC(2027, 8, 18, 14, 0);

describe('parseUrlState', () => {
  test('reads a known site and a UTC time', () => {
    expect(parseUrlState('?site=haworth&t=2027-09-18T14:00', SITES)).toEqual({ siteId: 'haworth', timeMs: T });
  });

  test('accepts a trailing Z, seconds and a date alone', () => {
    expect(parseUrlState('?t=2027-09-18T14:00Z', SITES).timeMs).toBe(T);
    expect(parseUrlState('?t=2027-09-18T14:00:30', SITES).timeMs).toBe(T + 30_000);
    expect(parseUrlState('?t=2027-09-18', SITES).timeMs).toBe(Date.UTC(2027, 8, 18));
  });

  test('ignores an unknown site and a malformed or impossible time', () => {
    expect(parseUrlState('?site=atlantis&t=yesterday', SITES)).toEqual({ siteId: null, timeMs: null });
    expect(parseUrlState('?t=2027-13-45T99:99', SITES).timeMs).toBeNull();
    expect(parseUrlState('?t=<script>', SITES).timeMs).toBeNull();
  });

  test('nothing asked, nothing returned', () => {
    expect(parseUrlState('', SITES)).toEqual({ siteId: null, timeMs: null });
  });
});

describe('buildUrlSearch', () => {
  test('writes site, time and language', () => {
    expect(buildUrlSearch('', { siteId: 'haworth', timeMs: T, locale: 'es' })).toBe('?site=haworth&t=2027-09-18T14%3A00&lang=es');
  });

  test('keeps other parameters and replaces the old values', () => {
    const search = buildUrlSearch('?site=old&debug=1&lang=en', { siteId: 'haworth', timeMs: T, locale: 'es' });
    const params = new URLSearchParams(search);
    expect(params.get('debug')).toBe('1');
    expect(params.get('site')).toBe('haworth');
    expect(params.get('lang')).toBe('es');
  });

  test('what it writes is what parseUrlState reads back', () => {
    const search = buildUrlSearch('', { siteId: 'site01', timeMs: T, locale: 'en' });
    expect(parseUrlState(search, SITES)).toEqual({ siteId: 'site01', timeMs: T });
    expect(formatUrlTime(T)).toBe('2027-09-18T14:00');
  });
});

describe('startUrlSync', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function fakeWindow(search = '') {
    const calls = [];
    return {
      calls,
      location: { search, pathname: '/app/', hash: '' },
      history: { state: null, replaceState: (...args) => calls.push(args) },
    };
  }
  const makeStore = () => createStore({ scenarios: { A: { siteId: 'haworth', timeMs: T }, B: null }, locale: 'es' });

  test('writes the address after a change, without adding history', () => {
    const win = fakeWindow();
    const store = makeStore();
    startUrlSync(store, { win, intervalMs: 500 });
    store.set({ scenarios: { A: { siteId: 'haworth', timeMs: T + 3_600_000 }, B: null } });
    expect(win.calls).toHaveLength(0);
    vi.advanceTimersByTime(500);
    expect(win.calls).toHaveLength(1);
    expect(win.calls[0][2]).toBe('/app/?site=haworth&t=2027-09-18T15%3A00&lang=es');
  });

  test('a burst of changes (the animation) is written once, with the latest value', () => {
    const win = fakeWindow();
    const store = makeStore();
    startUrlSync(store, { win, intervalMs: 500 });
    for (let i = 1; i <= 50; i++) store.set({ scenarios: { A: { siteId: 'haworth', timeMs: T + i * 3_600_000 }, B: null } });
    vi.advanceTimersByTime(500);
    expect(win.calls).toHaveLength(1);
    expect(win.calls[0][2]).toContain('t=2027-09-20T16%3A00');
  });

  test('does not rewrite an address that has not changed', () => {
    const win = fakeWindow();
    const store = makeStore();
    startUrlSync(store, { win, intervalMs: 500 });
    store.set({ playing: true });
    vi.advanceTimersByTime(500);
    store.set({ playing: false });
    vi.advanceTimersByTime(500);
    expect(win.calls).toHaveLength(1);
  });

  test('stopping cancels a pending write', () => {
    const win = fakeWindow();
    const store = makeStore();
    const stop = startUrlSync(store, { win, intervalMs: 500 });
    store.set({ locale: 'en' });
    stop();
    vi.advanceTimersByTime(1000);
    expect(win.calls).toHaveLength(0);
  });

  test('a browser that refuses replaceState does not break the page', () => {
    const win = fakeWindow();
    win.history.replaceState = () => {
      throw new Error('SecurityError');
    };
    const store = makeStore();
    startUrlSync(store, { win, intervalMs: 500 });
    store.set({ locale: 'en' });
    expect(() => vi.advanceTimersByTime(500)).not.toThrow();
  });
});
