import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { setLocale } from '../src/i18n.js';
import { DEFAULT_THRESHOLDS } from '../src/metrics/scenario.js';
import { createStore } from '../src/state.js';
import { mountInterface } from '../src/ui/interface.js';
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
    shadowLift: false,
    viewMode: 'follow',
    locale: 'es',
  });
  const timelines = { created: 0, destroyed: 0, cursors: [], options: [] };
  const renderTimeline = (el, site, fromMs, toMs, cursorMs, options) => {
    timelines.created += 1;
    timelines.options.push(options);
    return {
      destroy: () => (timelines.destroyed += 1),
      setCursor: (ms) => timelines.cursors.push(ms),
    };
  };
  const drawer = document.createElement('div');
  drawer.id = 'app';
  document.body.append(drawer);
  mountInterface(drawer, store, siteList, sites, { renderTimeline, audioCue });
  // the bars are outside the drawer: look everywhere in the page
  return { store, root: document.body, timelines };
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

  test('the page language follows the interface language', () => {
    const { root } = setup();
    expect(document.documentElement.lang).toBe('es');
    const select = q(root, 'locale');
    select.value = 'en';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.documentElement.lang).toBe('en');
    q(root, 'locale').value = 'es';
    q(root, 'locale').dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.documentElement.lang).toBe('es');
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

describe('3D view toggles', () => {
  test('"lighten shadows" toggles the store flag and aria-pressed', () => {
    const { root, store } = setup();
    expect(q(root, 'shadow-lift-toggle').getAttribute('aria-pressed')).toBe('false');
    q(root, 'shadow-lift-toggle').click();
    expect(store.get().shadowLift).toBe(true);
    expect(q(root, 'shadow-lift-toggle').getAttribute('aria-pressed')).toBe('true');
    q(root, 'shadow-lift-toggle').click();
    expect(store.get().shadowLift).toBe(false);
  });

  test('the view button switches between follow and free view', () => {
    const { root, store } = setup();
    expect(q(root, 'view-toggle').getAttribute('aria-pressed')).toBe('false');
    q(root, 'view-toggle').click();
    expect(store.get().viewMode).toBe('free');
    expect(q(root, 'view-toggle').getAttribute('aria-pressed')).toBe('true');
    q(root, 'view-toggle').click();
    expect(store.get().viewMode).toBe('follow');
  });
});

describe('timeline scrubbing wired to the scenario time', () => {
  test('onScrub sets the time of scenario A', () => {
    const { store, timelines } = setup();
    timelines.options.at(-1).onScrub(T0 + 8 * HOUR);
    expect(store.get().scenarios.A.timeMs).toBe(T0 + 8 * HOUR);
  });

  test('getTime reports the current time so the keyboard can step from it', () => {
    const { store, timelines } = setup();
    expect(timelines.options.at(-1).getTime()).toBe(T0 + 5 * HOUR);
    store.set({ scenarios: { A: { siteId: 'tiny-site', timeMs: T0 + 9 * HOUR }, B: null } });
    expect(timelines.options.at(-1).getTime()).toBe(T0 + 9 * HOUR);
  });

  test('scrubbing pauses a running animation', () => {
    const { root, store, timelines } = setup();
    q(root, 'play-toggle').click();
    expect(store.get().playing).toBe(true);
    timelines.options.at(-1).onScrub(T0 + 8 * HOUR);
    expect(store.get().playing).toBe(false);
  });

  test('a position beyond the data is clamped to the last sample', () => {
    const { store, timelines } = setup();
    timelines.options.at(-1).onScrub(Date.UTC(2031, 0, 1));
    expect(store.get().scenarios.A.timeMs).toBe(T0 + 47 * HOUR);
    timelines.options.at(-1).onScrub(Date.UTC(2020, 0, 1));
    expect(store.get().scenarios.A.timeMs).toBe(T0);
  });

  test('in compare mode the chart of B only moves B', () => {
    const { root, store, timelines } = setup();
    q(root, 'compare-toggle').click(); // rebuilds: charts A then B
    const before = store.get().scenarios.A.timeMs;
    timelines.options.at(-1).onScrub(T0 + 20 * HOUR); // the last chart created is B's
    expect(store.get().scenarios.B.timeMs).toBe(T0 + 20 * HOUR);
    expect(store.get().scenarios.A.timeMs).toBe(before);
  });
});

describe('interface and verdict cues', () => {
  const allFail = { minSunElDeg: 91, maxDarkH: -1, maxEarthGapH: -1 };
  const cueSpy = () => {
    const played = [];
    return { played, setEnabled: (next) => next, play: (name) => played.push(name) };
  };

  test('pressing a toolbar button plays the click cue', () => {
    const audioCue = cueSpy();
    const { root } = setup(audioCue);
    q(root, 'compare-toggle').click();
    expect(audioCue.played).toContain('click');
  });

  test('changing the language select plays the click cue', () => {
    const audioCue = cueSpy();
    const { root } = setup(audioCue);
    const select = q(root, 'locale');
    select.value = 'en';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(audioCue.played).toContain('click');
  });

  test('the player bar buttons play the click cue too', () => {
    const audioCue = cueSpy();
    const { root } = setup(audioCue);
    q(root, 'skip-fwd-hour').click();
    expect(audioCue.played).toContain('click');
  });

  test('the first render does not play a verdict cue', () => {
    const audioCue = cueSpy();
    setup(audioCue);
    expect(audioCue.played.filter((n) => n.startsWith('verdict'))).toEqual([]);
  });

  test('a verdict that changes plays the cue for the new level', () => {
    const audioCue = cueSpy();
    const { store } = setup(audioCue);
    store.set({ thresholds: allFail });
    expect(audioCue.played).toContain('verdict-red');
  });

  test('an unchanged verdict stays silent', () => {
    const audioCue = cueSpy();
    const { store } = setup(audioCue);
    store.set({ thresholds: allFail });
    audioCue.played.length = 0;
    store.set({ windowMs: 48 * HOUR });
    expect(audioCue.played.filter((n) => n.startsWith('verdict'))).toEqual([]);
  });

  test('verdict changes stay silent while the animation plays', () => {
    const audioCue = cueSpy();
    const { store } = setup(audioCue);
    store.set({ playing: true, thresholds: allFail });
    expect(audioCue.played.filter((n) => n.startsWith('verdict'))).toEqual([]);
  });

  test('works without an audio cue', () => {
    const { root, store } = setup();
    expect(() => {
      q(root, 'compare-toggle').click();
      store.set({ thresholds: allFail });
    }).not.toThrow();
  });
});

describe('volume and music controls', () => {
  test('a volume slider starts at the stored volume', () => {
    const { root } = setup();
    const slider = q(root, 'volume');
    expect(slider.type).toBe('range');
    expect(Number(slider.value)).toBeCloseTo(0.6);
    expect(slider.getAttribute('aria-label')).toBe('Volumen');
  });

  test('moving the slider sets the cue volume and the stored volume', () => {
    const volumes = [];
    const { root, store } = setup({ setEnabled: (next) => next, setVolume: (v) => volumes.push(v) });
    const slider = q(root, 'volume');
    slider.value = '0.3';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(volumes).toEqual([0.3]);
    expect(store.get().volume).toBe(0.3);
  });

  test('the slider keeps the stored volume when the panel is rebuilt (language change)', () => {
    const { root, store } = setup();
    store.set({ volume: 0.2 });
    store.set({ locale: 'en' });
    expect(Number(q(root, 'volume').value)).toBeCloseTo(0.2);
  });

  test('moving the slider works without an audio cue', () => {
    const { root } = setup();
    const slider = q(root, 'volume');
    slider.value = '0.5';
    expect(() => slider.dispatchEvent(new Event('input', { bubbles: true }))).not.toThrow();
  });

  test('the Sun elevation of scenario A is sent to the cue', () => {
    const elevations = [];
    const { root } = setup({ setEnabled: (next) => next, setSunElevation: (deg) => elevations.push(deg) });
    expect(elevations.length).toBeGreaterThan(0);
    expect(elevations.every((deg) => Number.isFinite(deg))).toBe(true);
    expect(q(root, 'sun-countdown')).toBeTruthy();
  });

  test('scenario B does not drive the music', () => {
    const elevations = [];
    const { store } = setup({ setEnabled: (next) => next, setSunElevation: (deg) => elevations.push(deg) });
    store.set({ scenarios: { ...store.get().scenarios, B: { siteId: 'other', timeMs: T0 + 9 * HOUR } } });
    const afterB = elevations.length;
    store.set({ windowMs: 48 * HOUR });
    // each update sends exactly one elevation (A's), never two
    expect(elevations.length - afterB).toBe(1);
  });
});
