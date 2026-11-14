import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { setLocale } from '../src/i18n.js';
import { DEFAULT_THRESHOLDS } from '../src/metrics/scenario.js';
import { mountPanel } from '../src/panel/panel.js';
import { createStore } from '../src/state.js';
import { HOUR, T0, loadTinySite } from './helpers.js';

const site = loadTinySite();
const other = { ...site, info: { ...site.info, id: 'other' } };
const sites = new Map([
  ['tiny-site', site],
  ['other', other],
]);
const siteList = [
  { id: 'tiny-site', name: 'Tiny' },
  { id: 'other', name: 'Other' },
];

function setup(audioCue) {
  const store = createStore({
    scenarios: { A: { siteId: 'tiny-site', timeMs: T0 + 5 * HOUR }, B: null },
    windowMs: 24 * HOUR,
    thresholds: { ...DEFAULT_THRESHOLDS },
    playing: false,
    soundEnabled: false,
    locale: 'es',
  });
  const timelines = { created: 0, destroyed: 0, cursors: [] };
  const renderTimeline = () => {
    timelines.created += 1;
    return {
      destroy: () => (timelines.destroyed += 1),
      setCursor: (ms) => timelines.cursors.push(ms),
    };
  };
  const root = document.createElement('div');
  document.body.append(root);
  mountPanel(root, store, siteList, sites, { renderTimeline, audioCue });
  return { store, root, timelines };
}

const q = (root, id) => root.querySelector(`[data-testid="${id}"]`);

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  setLocale('es');
  document.body.replaceChildren();
});

describe('mountPanel', () => {
  test('renders scenario A: card metrics and a timeline', () => {
    const { root, timelines } = setup();
    expect(q(root, 'sun-countdown').textContent).toBe('4 h 37 min');
    expect(q(root, 'verdict').classList.contains('verdict-green')).toBe(true);
    expect(timelines.created).toBe(1);
  });

  test('Compare adds scenario B with a diff block; pressing it again removes B', () => {
    const { root, store } = setup();
    q(root, 'compare-toggle').click();
    expect(store.get().scenarios.B).toEqual(store.get().scenarios.A);
    expect(root.querySelectorAll('.scenario')).toHaveLength(2);
    expect(q(root, 'diff-sunFraction').textContent).toBe('0 pp');
    q(root, 'compare-toggle').click();
    expect(store.get().scenarios.B).toBeNull();
    expect(root.querySelectorAll('.scenario')).toHaveLength(1);
  });

  test('B can use the same site at another date and the diff reflects it', () => {
    const { root, store } = setup();
    q(root, 'compare-toggle').click();
    const state = store.get();
    store.set({ scenarios: { A: state.scenarios.A, B: { ...state.scenarios.B, timeMs: T0 + 30 * HOUR } } });
    // B's window is clipped at the data end (17 h, 3.62 h of Sun) vs A's 24 h (7.25 h of Sun)
    expect(q(root, 'diff-sunFraction').textContent).toBe('−9 pp');
  });

  test('switching language re-renders in English', () => {
    const { root } = setup();
    const select = q(root, 'locale');
    select.value = 'en';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(root.textContent).toContain('Synthetic site');
  });

  test('the date input follows the store while the animation moves time', () => {
    const { root, store } = setup();
    store.set({ scenarios: { A: { siteId: 'tiny-site', timeMs: T0 + 8 * HOUR }, B: null } });
    expect(q(root, 'time-A').value).toBe('2026-01-01T08:00');
  });

  test('the timeline is rebuilt for a new window but only moves its cursor for a new time', () => {
    const { store, timelines } = setup();
    store.set({ scenarios: { A: { siteId: 'tiny-site', timeMs: T0 + 8 * HOUR }, B: null } });
    expect(timelines.created).toBe(1);
    expect(timelines.cursors).toContain(T0 + 8 * HOUR);
    store.set({ windowMs: 7 * 24 * HOUR });
    expect(timelines.created).toBe(2);
  });

  test('a time outside the data is clamped instead of crashing', () => {
    const { root, store } = setup();
    store.set({ scenarios: { A: { siteId: 'tiny-site', timeMs: Date.UTC(2031, 0, 1) }, B: null } });
    expect(store.get().scenarios.A.timeMs).toBe(T0 + 47 * HOUR);
    expect(q(root, 'verdict')).not.toBeNull();
  });

  test('the play button toggles the animation', () => {
    const { root, store } = setup();
    q(root, 'play-toggle').click();
    expect(store.get().playing).toBe(true);
    q(root, 'play-toggle').click();
    expect(store.get().playing).toBe(false);
  });
});

describe('sound toggle', () => {
  test('stays off when the audio cue cannot start (no Web Audio)', () => {
    const { root, store } = setup({ setEnabled: () => false });
    q(root, 'sound-toggle').click();
    expect(store.get().soundEnabled).toBe(false);
    expect(q(root, 'sound-toggle').getAttribute('aria-pressed')).toBe('false');
  });

  test('turns on and off following what the audio cue reports', () => {
    const { root, store } = setup({ setEnabled: (next) => next });
    q(root, 'sound-toggle').click();
    expect(store.get().soundEnabled).toBe(true);
    expect(q(root, 'sound-toggle').getAttribute('aria-pressed')).toBe('true');
    q(root, 'sound-toggle').click();
    expect(store.get().soundEnabled).toBe(false);
  });
});

