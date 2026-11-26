import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { setLocale } from '../src/i18n.js';
import { nextEvent } from '../src/metrics/events.js';
import { DEFAULT_THRESHOLDS } from '../src/metrics/scenario.js';
import { createStore } from '../src/state.js';
import { mountInterface } from '../src/ui/interface.js';
import { RANGES, windowFor } from '../src/ui/playbar.js';
import { SPEEDS } from '../src/ui/playback.js';
import { HOUR, T0, loadTinySite } from './helpers.js';

const site = loadTinySite();
const sites = new Map([['tiny-site', site]]);
const siteList = [{ id: 'tiny-site', name: 'Tiny' }];
const at = (hours) => T0 + hours * HOUR;
const q = (id) => document.querySelector(`[data-testid="${id}"]`);

describe('nextEvent', () => {
  test('looks past a transition of the other kind: a visible Sun sets first, and the sunrise is the one after', () => {
    const rise = nextEvent(site, 'sun', 'rise', at(5));
    expect(rise.kind).toBe('rise');
    expect(Math.abs((rise.atMs - T0) / HOUR - 26.37566)).toBeLessThan(0.001);
    const set = nextEvent(site, 'sun', 'set', at(5));
    expect(Math.abs((set.atMs - T0) / HOUR - 9.62434)).toBeLessThan(0.001);
  });

  test('the Earth: the next rise is at 19.15 h even though it sets at 11.85 h first', () => {
    expect(Math.abs((nextEvent(site, 'earth', 'rise', at(5)).atMs - T0) / HOUR - 19.15)).toBeLessThan(0.001);
  });

  test('null when the data ends first', () => {
    expect(nextEvent(site, 'sun', 'set', at(40))).toBeNull(); // the Sun rose at 26 h and stays up to the end
    expect(nextEvent(site, 'sun', 'rise', at(46.9))).toBeNull();
  });
});

describe('windowFor', () => {
  const data = { startMs: 0, endMs: 1000 };

  test('no range covers all the data', () => {
    expect(windowFor(data, null, 400, null)).toEqual({ startMs: 0, endMs: 1000, zoomed: false });
    expect(windowFor(data, 5000, 400, null).zoomed).toBe(false); // a range longer than the data is all of it
  });

  test('a window is centred on the moment when it is chosen', () => {
    expect(windowFor(data, 200, 500, null)).toEqual({ startMs: 400, endMs: 600, zoomed: true });
  });

  test('it keeps its place while the moment stays inside, and re-centres when the moment leaves', () => {
    expect(windowFor(data, 200, 450, 400).startMs).toBe(400);
    expect(windowFor(data, 200, 650, 400).startMs).toBe(550);
  });

  test('it never passes the ends of the data', () => {
    expect(windowFor(data, 200, 10, null)).toEqual({ startMs: 0, endMs: 200, zoomed: true });
    expect(windowFor(data, 200, 990, null)).toEqual({ startMs: 800, endMs: 1000, zoomed: true });
  });

  test('the ranges on offer: all, a year, 30 days and a week', () => {
    expect(RANGES.map((r) => r.id)).toEqual(['all', 'year', 'month', 'week']);
  });
});

describe('player bar tools and shortcuts', () => {
  let ui;
  let store;

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    store = createStore({
      scenarios: { A: { siteId: 'tiny-site', timeMs: at(5) }, B: null },
      windowMs: 24 * HOUR,
      thresholds: { ...DEFAULT_THRESHOLDS },
      playing: false,
      soundEnabled: false,
      shadowLift: false,
      viewMode: 'follow',
      panelOpen: false,
      locale: 'es',
    });
    const drawer = document.createElement('div');
    document.body.append(drawer);
    ui = mountInterface(drawer, store, siteList, sites, {
      renderTimeline: () => ({ destroy() {}, setCursor() {} }),
      audioCue: { setEnabled: (next) => next, play() {} },
    });
  });
  afterEach(() => {
    ui.dispose();
    vi.unstubAllGlobals();
    setLocale('es');
    document.body.replaceChildren();
  });

  const press = (code, target = document.body) => {
    const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };

  test('the events menu lists the four events with their moments, and choosing one jumps there', () => {
    q('events').click();
    const items = [...q('events').parentElement.querySelectorAll('[role="menuitem"]')];
    expect(items.map((i) => i.dataset.testid)).toEqual(['event-sunrise', 'event-sunset', 'event-earthrise', 'event-earthset']);
    expect(items[0].textContent).toContain('Próxima salida del Sol');
    expect(items[0].textContent).toContain('2026-01-02 02:23 UTC'); // 26.37566 h after T0, rounded up to the minute
    items[0].click();
    const jumped = store.get().scenarios.A.timeMs;
    expect(jumped).toBeGreaterThanOrEqual(at(26.37566));
    expect(jumped - at(26.37566)).toBeLessThan(60_000);
  });

  test('an event that is not in the data is shown as such and cannot be chosen', () => {
    store.set({ scenarios: { A: { siteId: 'tiny-site', timeMs: at(40) }, B: null } });
    q('events').click();
    const sunset = q('event-sunset');
    expect(sunset.disabled).toBe(true);
    expect(sunset.textContent).toContain('no hay en los datos');
    expect(store.get().scenarios.A.timeMs).toBe(at(40));
  });

  test('the range menu zooms the line to a window around the moment, and back to all of it', () => {
    const slider = q('seek');
    expect(slider.min).toBe('0');
    expect(slider.max).toBe('47');
    q('range').click();
    q('range-week').click(); // a week is longer than these 48 hours of data: still all of it
    expect(slider.max).toBe('47');
    expect(q('range').getAttribute('aria-label')).toContain('7 días');
    expect(q('range-week').getAttribute('aria-checked')).toBe('true');
    q('range').click();
    q('range-all').click();
    expect(q('range-all').getAttribute('aria-checked')).toBe('true');
  });

  test('with enough data a range narrows the line to a window of that length, with its dates, and re-centres near the edge', () => {
    const flat = (value) => new Float32Array(24 * 60).fill(value);
    // the tiny site with 60 days of data, one sample an hour
    sites.set('long', { ...site, eph: { ...site.eph, count: 24 * 60, sunEl: flat(1), sunAz: flat(90), earthEl: flat(1), earthAz: flat(180) } });
    store.set({ scenarios: { A: { siteId: 'long', timeMs: at(720) }, B: null } });
    const slider = q('seek');
    expect(slider.max).toBe('1439');
    q('range').click();
    q('range-week').click();
    expect(Number(slider.max) - Number(slider.min)).toBe(168);
    expect(Number(slider.min)).toBe(720 - 84); // centred on the moment
    expect([...document.querySelectorAll('.pb-year')].map((n) => n.textContent)).toEqual(['2026-01-27', '2026-01-31', '2026-02-03']);
    // dragging inside the window does not move it
    slider.value = String(720 + 30);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    expect(Number(slider.min)).toBe(720 - 84);
    // letting go near the end of it centres the window on the moment
    slider.value = String(720 + 80);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    expect(Number(slider.min)).toBe(720 + 80 - 84);
    q('range').click();
    q('range-all').click();
    expect(slider.max).toBe('1439');
    sites.delete('long');
  });

  test('space plays and pauses, [ and ] change the speed, comma and period step an hour', () => {
    expect(press('Space').defaultPrevented).toBe(true);
    expect(store.get().playing).toBe(true);
    press('Space');
    expect(store.get().playing).toBe(false);
    const before = ui.playback.speedMs;
    press('BracketRight');
    expect(ui.playback.speedMs).toBe(SPEEDS[SPEEDS.findIndex((s) => s.ms === before) + 1].ms);
    press('BracketLeft');
    expect(ui.playback.speedMs).toBe(before);
    press('Period');
    expect(store.get().scenarios.A.timeMs).toBe(at(6));
    press('Comma');
    expect(store.get().scenarios.A.timeMs).toBe(at(5));
  });

  test('the shortcuts leave alone a control that uses the keys, and the tutorial and Analysis window own the keyboard', () => {
    const slider = q('seek');
    expect(press('Space', slider).defaultPrevented).toBe(false);
    expect(store.get().playing).toBe(false);
    ui.tutorial.open();
    press('Period');
    expect(store.get().scenarios.A.timeMs).toBe(at(5));
    ui.tutorial.close();
    expect(press('KeyX').defaultPrevented).toBe(false); // not a shortcut
  });

  test('the play button names its shortcut', () => {
    expect(q('play-toggle').title).toBe('Reproducir (barra espaciadora)');
  });
});
