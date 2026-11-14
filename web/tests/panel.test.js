import { afterEach, describe, expect, test } from 'vitest';
import { setLocale } from '../src/i18n.js';
import { renderScenarioCard } from '../src/panel/scenarioCard.js';
import { clampTime, renderControls } from '../src/panel/controls.js';
import { DEFAULT_THRESHOLDS, evaluateScenario, viability } from '../src/metrics/scenario.js';
import { createStore } from '../src/state.js';
import es from '../src/strings/es.json';
import { HOUR, T0, loadTinySite, makeSite } from './helpers.js';

const site = loadTinySite();
const text = (el, id) => el.querySelector(`[data-testid="${id}"]`).textContent;

afterEach(() => setLocale('es'));

describe('clampTime', () => {
  test('a time inside the data is unchanged', () => {
    expect(clampTime(site.eph, T0 + 5 * HOUR)).toEqual({ timeMs: T0 + 5 * HOUR, clamped: false });
  });

  test('2031 is clamped to the end of the data, 2020 to the start', () => {
    expect(clampTime(site.eph, Date.UTC(2031, 0, 1))).toEqual({ timeMs: T0 + 47 * HOUR, clamped: true });
    expect(clampTime(site.eph, Date.UTC(2020, 0, 1))).toEqual({ timeMs: T0, clamped: true });
  });
});

describe('renderScenarioCard', () => {
  const metrics = evaluateScenario(site, T0 + 5 * HOUR, 24 * HOUR);

  function render(m = metrics, v = viability(m), info = site.info) {
    const el = document.createElement('div');
    renderScenarioCard(el, m, v, info);
    return el;
  }

  test('shows title, countdowns, longest gap and a green verdict', () => {
    const el = render();
    expect(el.textContent).toContain('Sitio sintético');
    expect(text(el, 'sun-countdown')).toBe('4 h 37 min');
    expect(text(el, 'earth-countdown')).toBe('6 h 51 min');
    expect(text(el, 'earth-gap')).toBe('7 h 18 min');
    expect(el.querySelector('[data-testid="verdict"]').classList.contains('verdict-green')).toBe(true);
  });

  test('a failed check is named next to an amber verdict', () => {
    const el = render(metrics, viability(metrics, { ...DEFAULT_THRESHOLDS, maxDarkH: 10 }));
    expect(el.querySelector('[data-testid="verdict"]').classList.contains('verdict-amber')).toBe(true);
    expect(text(el, 'verdict-reasons')).toContain(es['verdict.failed.dark']);
  });

  test('with no change in the data, the countdown says so instead of a time', () => {
    const night = makeSite({ sunEl: new Array(48).fill(-1) });
    night.info.sign = site.info.sign;
    const m = evaluateScenario(night, T0 + 5 * HOUR, 24 * HOUR);
    expect(text(render(m, viability(m), night.info), 'sun-countdown')).toBe(es['card.noChange']);
  });

  test('in permanent darkness the countdown is labelled as a sunrise, not a sunset', () => {
    const night = makeSite({ sunEl: new Array(48).fill(-1) });
    night.info.sign = site.info.sign;
    const m = evaluateScenario(night, T0 + 5 * HOUR, 24 * HOUR);
    const label = render(m, viability(m), night.info).querySelector('.stat.sun .stat-label').textContent;
    expect(label).toBe(es['card.sunRises']);
  });

  test('in permanent daylight the countdown is labelled as a sunset', () => {
    const day = makeSite({ sunEl: new Array(48).fill(1) });
    day.info.sign = site.info.sign;
    const m = evaluateScenario(day, T0 + 5 * HOUR, 24 * HOUR);
    const label = render(m, viability(m), day.info).querySelector('.stat.sun .stat-label').textContent;
    expect(label).toBe(es['card.sunSets']);
  });

  test('uses the active locale for the sign text', () => {
    setLocale('en');
    expect(render().textContent).toContain('Synthetic site');
  });
});

describe('renderControls', () => {
  const other = { ...site, info: { ...site.info, id: 'other' } };
  const sites = new Map([
    ['tiny-site', site],
    ['other', other],
  ]);
  const siteList = [
    { id: 'tiny-site', name: 'Tiny' },
    { id: 'other', name: 'Other' },
  ];

  function setup() {
    const store = createStore({
      scenarios: { A: { siteId: 'tiny-site', timeMs: T0 + 5 * HOUR }, B: null },
      windowMs: 24 * HOUR,
      thresholds: { ...DEFAULT_THRESHOLDS },
      playing: false,
      locale: 'es',
    });
    const el = document.createElement('div');
    renderControls(el, store, siteList, sites, 'A');
    return { store, el };
  }

  const change = (el, testId, value) => {
    const input = el.querySelector(`[data-testid="${testId}"]`);
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  test('setting the date to 2031 clamps to the data end and shows a warning', () => {
    const { store, el } = setup();
    change(el, 'time-A', '2031-01-01T00:00');
    expect(store.get().scenarios.A.timeMs).toBe(T0 + 47 * HOUR);
    const warning = el.querySelector('[data-testid="range-warning"]');
    expect(warning.hidden).toBe(false);
    expect(warning.textContent).toContain('2026-01-02');
  });

  test('while the date field has focus the typed text is kept; on blur it shows the clamped value', () => {
    const { store, el } = setup();
    document.body.append(el);
    const input = el.querySelector('[data-testid="time-A"]');
    input.focus();
    change(el, 'time-A', '2031-01-01T00:00');
    expect(store.get().scenarios.A.timeMs).toBe(T0 + 47 * HOUR);
    expect(input.value).toBe('2031-01-01T00:00');
    input.blur();
    expect(input.value).toBe('2026-01-02T23:00');
    el.remove();
  });

  test('a valid date updates the store and keeps the warning hidden', () => {
    const { store, el } = setup();
    change(el, 'time-A', '2026-01-01T10:00');
    expect(store.get().scenarios.A.timeMs).toBe(T0 + 10 * HOUR);
    expect(el.querySelector('[data-testid="range-warning"]').hidden).toBe(true);
  });

  test('changing site, window and thresholds updates the store', () => {
    const { store, el } = setup();
    change(el, 'site-A', 'other');
    expect(store.get().scenarios.A.siteId).toBe('other');
    change(el, 'window', String(7 * 24 * HOUR));
    expect(store.get().windowMs).toBe(7 * 24 * HOUR);
    change(el, 'max-dark', '10');
    expect(store.get().thresholds.maxDarkH).toBe(10);
  });
});
