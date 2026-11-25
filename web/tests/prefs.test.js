import { describe, expect, test } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../src/metrics/scenario.js';
import { PREFS_KEY, loadPrefs, sanitizePrefs, startPrefsSync } from '../src/prefs.js';
import { createStore } from '../src/state.js';

const DAY = 24 * 3_600_000;

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = String(v)) };
}

const baseState = () => ({
  shadowLift: false,
  lrocTexture: true,
  viewMode: 'follow',
  volume: 0.6,
  windowMs: 7 * DAY,
  thresholds: { ...DEFAULT_THRESHOLDS },
  soundEnabled: false,
  playing: false,
});

describe('sanitizePrefs', () => {
  test('keeps valid choices', () => {
    const prefs = {
      shadowLift: true,
      lrocTexture: false,
      viewMode: 'free',
      volume: 0.25,
      windowMs: DAY,
      thresholds: { minSunElDeg: 2, maxDarkH: 90, maxEarthGapH: 30 },
    };
    expect(sanitizePrefs(prefs)).toEqual(prefs);
  });

  test('drops values of the wrong type or out of range', () => {
    expect(sanitizePrefs({ shadowLift: 'yes', viewMode: 'orbit', volume: 7, windowMs: 123 })).toEqual({});
    expect(sanitizePrefs({ volume: NaN })).toEqual({});
  });

  test('a threshold that is damaged falls back to its default, the others are kept', () => {
    const { thresholds } = sanitizePrefs({ thresholds: { minSunElDeg: 'high', maxDarkH: 50, maxEarthGapH: -3 } });
    expect(thresholds).toEqual({ ...DEFAULT_THRESHOLDS, maxDarkH: 50 });
  });

  test('never carries sound on/off or anything it does not know', () => {
    expect(sanitizePrefs({ soundEnabled: true, panelOpen: true, evil: 1 })).toEqual({});
  });

  test('nonsense in, nothing out', () => {
    expect(sanitizePrefs(null)).toEqual({});
    expect(sanitizePrefs('x')).toEqual({});
    expect(sanitizePrefs(42)).toEqual({});
  });
});

describe('loadPrefs', () => {
  test('reads what was saved', () => {
    const storage = memoryStorage({ [PREFS_KEY]: JSON.stringify({ viewMode: 'free' }) });
    expect(loadPrefs(storage)).toEqual({ viewMode: 'free' });
  });

  test('a damaged file, an empty storage and a storage that throws all give {}', () => {
    expect(loadPrefs(memoryStorage({ [PREFS_KEY]: '{not json' }))).toEqual({});
    expect(loadPrefs(memoryStorage())).toEqual({});
    expect(
      loadPrefs({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toEqual({});
  });
});

describe('startPrefsSync', () => {
  test('saves when a saved choice changes', () => {
    const storage = memoryStorage();
    const store = createStore(baseState());
    startPrefsSync(store, storage);
    store.set({ shadowLift: true });
    expect(JSON.parse(storage.data[PREFS_KEY]).shadowLift).toBe(true);
  });

  test('does not write for changes that are not saved (animation, sound, time)', () => {
    const storage = memoryStorage();
    const store = createStore(baseState());
    startPrefsSync(store, storage);
    store.set({ playing: true, soundEnabled: true, scenarios: { A: { timeMs: 1 } } });
    expect(storage.data[PREFS_KEY]).toBeUndefined();
  });

  test('a storage that refuses to save does not break the page', () => {
    const store = createStore(baseState());
    startPrefsSync(store, {
      setItem: () => {
        throw new Error('full');
      },
    });
    expect(() => store.set({ viewMode: 'free' })).not.toThrow();
  });

  test('what is saved loads back the same', () => {
    const storage = memoryStorage();
    const store = createStore(baseState());
    startPrefsSync(store, storage);
    store.set({ viewMode: 'free', volume: 0.3, lrocTexture: false });
    expect(loadPrefs(storage)).toMatchObject({ viewMode: 'free', volume: 0.3, lrocTexture: false });
  });
});
