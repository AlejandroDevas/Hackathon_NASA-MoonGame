// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest';
import { formatDuration, formatDurationLong, setLocale, t } from '../src/i18n.js';
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

describe('formatDurationLong', () => {
  afterEach(() => setLocale('es'));

  test.each([
    [(8 * 24 + 18) * HOUR, '8 días y 18 horas'],
    [24 * HOUR, '1 día'],
    [25 * HOUR, '1 día y 1 hora'],
    [3 * 24 * HOUR, '3 días'],
    [7.3 * HOUR, '7 horas y 18 minutos'],
    [HOUR, '1 hora'],
    [30 * 60_000, '30 minutos'],
    [20_000, 'menos de 1 minuto'],
  ])('%d ms -> %s (es)', (ms, text) => {
    expect(formatDurationLong(ms)).toBe(text);
  });

  test('is written in English when the language is English', () => {
    setLocale('en');
    expect(formatDurationLong((8 * 24 + 18) * HOUR)).toBe('8 days and 18 hours');
    expect(formatDurationLong(25 * HOUR)).toBe('1 day and 1 hour');
    expect(formatDurationLong(20_000)).toBe('less than 1 minute');
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
