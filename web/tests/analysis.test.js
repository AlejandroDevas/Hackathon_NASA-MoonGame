import { afterEach, describe, expect, test } from 'vitest';
import { setLocale } from '../src/i18n.js';
import { DEFAULT_THRESHOLDS } from '../src/metrics/scenario.js';
import { comparisonCsv, comparisonRows, createAnalysis } from '../src/panel/analysis.js';
import { createStore } from '../src/state.js';
import { HOUR, T0, loadTinySite, makeSite } from './helpers.js';

const tiny = loadTinySite();
const HOURS = 300; // longer than the default 6.5-day stay (156 h) but shorter than 14 days
const sunnyEl = Array.from({ length: HOURS }, (_, i) => (i < 150 ? 5 : -5));
const sunny = {
  ...makeSite({ sunEl: sunnyEl, earthEl: Array.from({ length: HOURS }, () => 3) }),
};
sunny.horizon = tiny.horizon;
const dark = makeSite({ sunEl: new Array(HOURS).fill(-5), earthEl: new Array(HOURS).fill(-5) });
const sites = new Map([
  ['sunny', sunny],
  ['dark', dark],
]);
const siteList = [
  { id: 'sunny', name: 'Sunny "site"' },
  { id: 'dark', name: 'Dark' },
];

function setup() {
  const store = createStore({
    scenarios: { A: { siteId: 'sunny', timeMs: T0 + 2 * HOUR }, B: null },
    windowMs: 24 * HOUR,
    thresholds: { ...DEFAULT_THRESHOLDS },
    locale: 'es',
  });
  const analysis = createAnalysis(store, siteList, sites);
  return { store, analysis };
}

afterEach(() => {
  setLocale('es');
  document.body.replaceChildren();
  document.body.className = '';
});

describe('comparisonRows / comparisonCsv', () => {
  const rows = comparisonRows(siteList, sites, T0, 24 * HOUR, DEFAULT_THRESHOLDS);

  test('one row per site with its metrics and verdict', () => {
    expect(rows.map((r) => r.id)).toEqual(['sunny', 'dark']);
    expect(rows[0].metrics.sunFraction).toBeGreaterThan(0.9);
    expect(rows[1].metrics.sunFraction).toBe(0);
    expect(rows[0].verdict.level).toBeDefined();
  });

  test('CSV has a header, one line per site, quoted names and dot decimals', () => {
    const lines = comparisonCsv(rows, 24 * HOUR).trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      'site,start_utc,window_days,sun_percent,earth_percent,longest_light_h,longest_night_h,longest_earth_gap_h,verdict',
    );
    expect(lines[1].startsWith('"Sunny ""site""",2026-01-01T00:00:00.000Z,1.0,')).toBe(true);
    expect(lines[2]).toContain(',0.0,0.0,');
  });
});

describe('createAnalysis', () => {
  test('is closed and empty until opened, then shows every section', () => {
    const { analysis } = setup();
    expect(analysis.el.hidden).toBe(true);
    expect(analysis.isOpen()).toBe(false);
    analysis.open();
    expect(analysis.isOpen()).toBe(true);
    expect(analysis.el.hidden).toBe(false);
    expect(document.body.classList.contains('analysis-open')).toBe(true);
    expect(analysis.el.querySelector('[role="dialog"]').getAttribute('aria-modal')).toBe('true');
    expect(analysis.el.querySelector('[data-testid="best-windows"]')).not.toBeNull();
    expect(analysis.el.querySelector('[data-testid="calendar"]')).not.toBeNull();
    expect(analysis.el.querySelector('[data-testid="sky-plot"]')).not.toBeNull();
    expect(analysis.el.querySelectorAll('[data-testid="compare-table"] tbody tr')).toHaveLength(2);
  });

  test('closes with the button and with Escape, restoring the page', () => {
    const { analysis } = setup();
    analysis.open();
    analysis.el.querySelector('[data-testid="analysis-close"]').click();
    expect(analysis.isOpen()).toBe(false);
    expect(document.body.classList.contains('analysis-open')).toBe(false);
    analysis.open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(analysis.isOpen()).toBe(false);
    expect(analysis.el.hidden).toBe(true);
  });

  test('"show in the scene" moves scenario A to that window and closes', () => {
    const { analysis, store } = setup();
    analysis.open();
    const stay = analysis.el.querySelector('[data-testid="analysis-stay"]');
    expect(stay.options).toHaveLength(3);
    const first = analysis.el.querySelector('[data-testid="best-windows"] tbody .analysis-link');
    first.click();
    expect(analysis.isOpen()).toBe(false);
    const { siteId, timeMs } = store.get().scenarios.A;
    expect(siteId).toBe('sunny');
    expect(timeMs).toBe(T0); // the sunniest 6.5-day window starts at the first hour
  });

  test('a stay longer than the data shows no windows', () => {
    const { analysis } = setup();
    analysis.open();
    const stay = analysis.el.querySelector('[data-testid="analysis-stay"]');
    stay.value = String(14 * 24 * HOUR);
    stay.dispatchEvent(new Event('change'));
    expect(analysis.el.querySelector('[data-testid="best-windows"]')).toBeNull();
    expect(analysis.el.textContent).toContain('No hay ventanas');
  });

  test('re-renders in the new language when the locale changes while open', () => {
    const { analysis, store } = setup();
    analysis.open();
    expect(analysis.el.textContent).toContain('Mejores ventanas de aterrizaje');
    setLocale('en');
    store.set({ locale: 'en' });
    expect(analysis.el.textContent).toContain('Best landing windows');
  });

  test('changing the site redraws for that site', () => {
    const { analysis } = setup();
    analysis.open();
    const select = analysis.el.querySelector('[data-testid="analysis-site"]');
    select.value = 'dark';
    select.dispatchEvent(new Event('change'));
    expect(analysis.el.querySelector('h2').textContent).toContain('Dark');
  });
});
