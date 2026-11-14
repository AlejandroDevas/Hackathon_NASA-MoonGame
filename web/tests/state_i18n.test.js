import { afterEach, describe, expect, test, vi } from 'vitest';
import { formatDuration, setLocale, t } from '../src/i18n.js';
import en from '../src/strings/en.json';
import es from '../src/strings/es.json';
import { createStore } from '../src/state.js';

const HOUR = 3_600_000;

describe('createStore', () => {
  test('set merges into the state and notifies subscribers', () => {
    const store = createStore({ a: 1, b: 2 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ b: 3 });
    expect(store.get()).toEqual({ a: 1, b: 3 });
    expect(listener).toHaveBeenCalledWith({ a: 1, b: 3 });
  });

  test('an unsubscribed listener stops receiving updates', () => {
    const store = createStore({ a: 1 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set({ a: 2 });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('formatDuration', () => {
  test.each([
    [7.3 * HOUR, '7 h 18 min'],
    [51 * HOUR, '2 d 3 h'],
    [30 * 60_000, '30 min'],
    [20_000, '<1 min'],
    [2 * HOUR, '2 h'],
    [-5 * HOUR, '<1 min'],
  ])('%d ms -> %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe('t', () => {
  afterEach(() => setLocale('es'));

  test('returns the string of the active locale and substitutes params', () => {
    setLocale('es');
    expect(t('range.warning', { limit: '2030-12-31' })).toBe(es['range.warning'].replace('{limit}', '2030-12-31'));
    setLocale('en');
    expect(t('range.warning', { limit: 'X' })).toContain('X');
    expect(t('range.warning', { limit: 'X' })).toBe(en['range.warning'].replace('{limit}', 'X'));
  });

  test('an unknown key returns the key itself', () => {
    expect(t('no.such.key')).toBe('no.such.key');
  });

  test('es and en define exactly the same keys', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });
});
