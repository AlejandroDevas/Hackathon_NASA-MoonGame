import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { setLocale } from '../src/i18n.js';
import { DEFAULT_THRESHOLDS } from '../src/metrics/scenario.js';
import { createStore } from '../src/state.js';
import es from '../src/strings/es.json';
import { TEAM } from '../src/team.js';
import { ICON_NAMES, icon } from '../src/ui/icons.js';
import { mountInterface } from '../src/ui/interface.js';
import { formatMoment, yearMarks } from '../src/ui/playbar.js';
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
const LAST = T0 + 47 * HOUR;

function setup({ scenarios, extra = {} } = {}) {
  const store = createStore({
    scenarios: scenarios ?? { A: { siteId: 'tiny-site', timeMs: T0 + 5 * HOUR }, B: null },
    windowMs: 24 * HOUR,
    thresholds: { ...DEFAULT_THRESHOLDS },
    playing: false,
    soundEnabled: false,
    shadowLift: false,
    viewMode: 'follow',
    panelOpen: false,
    locale: 'es',
    ...extra,
  });
  const drawer = document.createElement('div');
  document.body.append(drawer);
  const ui = mountInterface(drawer, store, siteList, sites, {
    renderTimeline: () => ({ destroy() {}, setCursor() {} }),
    audioCue: { setEnabled: (next) => next, play() {} },
  });
  return { store, drawer, ui };
}
const q = (id) => document.querySelector(`[data-testid="${id}"]`);

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  setLocale('es');
  document.body.replaceChildren();
});

describe('top bar', () => {
  test('the name is on the left, followed by the language selector', () => {
    setup();
    const bar = document.querySelector('.topbar');
    const children = [...bar.children].map((c) => c.className);
    expect(children[0]).toContain('topbar-brand');
    expect(children[1]).toContain('topbar-locale');
    expect(children[2]).toContain('topbar-site');
    expect(bar.querySelector('h1').textContent).toBe(es['app.title']);
    expect(bar.querySelector('.topbar-kicker').textContent).toBe(es['app.kicker']);
    expect(q('locale').tagName).toBe('SELECT');
  });

  test('on the right, from right to left: sound, lighten shadows, LROC image and free view, then the menu at the corner', () => {
    setup();
    const bar = document.querySelector('.topbar');
    const order = [...bar.querySelectorAll('[data-testid]')].map((n) => n.dataset.testid);
    const tools = order.filter((id) => ['view-toggle', 'lroc-toggle', 'shadow-lift-toggle', 'sound-toggle'].includes(id));
    // left to right in the page = free view, LROC, shadows, sound; read from the right it is sound, shadows, LROC, free view
    expect(tools).toEqual(['view-toggle', 'lroc-toggle', 'shadow-lift-toggle', 'sound-toggle']);
    expect(tools.slice().reverse()).toEqual(['sound-toggle', 'shadow-lift-toggle', 'lroc-toggle', 'view-toggle']);
    expect(order.indexOf('menu-toggle')).toBeGreaterThan(order.indexOf('sound-toggle'));
    expect(bar.lastElementChild.className).toContain('topbar-menu');
  });

  test('the volume slider sits in the top bar, just left of the sound button', () => {
    setup();
    const tools = [...document.querySelector('.topbar-tools').children];
    expect(tools.indexOf(q('volume'))).toBe(tools.indexOf(q('sound-toggle')) - 1);
    expect(q('volume').type).toBe('range');
    expect(q('volume').getAttribute('aria-label')).toBe('Volumen');
  });

  test('the menu offers the planner, the Analysis window, Compare and the tutorial, and nothing else', () => {
    setup();
    const items = [...q('menu').querySelectorAll('[role^="menuitem"]')].map((n) => n.dataset.testid);
    expect(items).toEqual(['panel-toggle', 'analysis-open', 'compare-toggle', 'tutorial-open']);
    expect(q('menu').getAttribute('role')).toBe('menu');
    expect(q('menu').hidden).toBe(true);
  });

  test('the menu button opens the menu, and the toggles are not inside it', () => {
    setup();
    q('menu-toggle').click();
    expect(q('menu').hidden).toBe(false);
    expect(q('menu-toggle').getAttribute('aria-expanded')).toBe('true');
    expect(q('menu').contains(q('sound-toggle'))).toBe(false);
  });

  test('the Analysis item opens the Analysis window', () => {
    setup();
    q('analysis-open').click();
    expect(document.querySelector('[data-testid="analysis"]').hidden).toBe(false);
  });

  test('the toggles show their state with aria-pressed and a text that follows the state', () => {
    const { store } = setup();
    expect(q('sound-toggle').getAttribute('aria-pressed')).toBe('false');
    expect(q('sound-toggle').textContent).toContain(es['app.soundOn']);
    q('sound-toggle').click();
    expect(store.get().soundEnabled).toBe(true);
    expect(q('sound-toggle').getAttribute('aria-pressed')).toBe('true');
    expect(q('sound-toggle').textContent).toContain(es['app.soundOff']);
    expect(q('view-toggle').textContent).toContain(es['app.viewFree']);
    q('view-toggle').click();
    expect(q('view-toggle').textContent).toContain(es['app.viewFollow']);
  });

  test('every toggle keeps an accessible name even when only its icon is visible', () => {
    setup();
    for (const id of ['view-toggle', 'lroc-toggle', 'shadow-lift-toggle', 'sound-toggle', 'menu-toggle']) {
      expect(q(id).getAttribute('aria-label') || q(id).textContent.trim(), id).not.toBe('');
      expect(q(id).querySelector('svg').getAttribute('aria-hidden')).toBe('true');
    }
  });

  test('changing the language re-labels the bars and the page language follows', () => {
    setup();
    q('locale').value = 'en';
    q('locale').dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.documentElement.lang).toBe('en');
    expect(document.querySelector('.topbar h1').textContent).toBe('Inside Moon 153');
    expect(q('menu-toggle').textContent).toContain('Menu');
    expect(q('play-toggle').getAttribute('aria-label')).toBe('Play');
    expect(q('panel-toggle').textContent).toContain('Planner');
  });
});

describe('team credits', () => {
  test('the planner footer names the team, in alphabetical order by surname, and follows the language', () => {
    const { drawer } = setup();
    const line = drawer.querySelector('.app-team');
    expect(line.textContent).toBe(
      'Equipo: Israel Alejandro Calvario Mena · Gerardo Andrés Galindo Aparicio · Jessica Betzania Texis Juárez',
    );
    expect(TEAM.map((name) => name.split(' ').slice(-2).join(' '))).toEqual(['Calvario Mena', 'Galindo Aparicio', 'Texis Juárez']);
    q('locale').value = 'en';
    q('locale').dispatchEvent(new Event('change', { bubbles: true }));
    expect(drawer.querySelector('.app-team').textContent.startsWith('Team: ')).toBe(true);
  });

  test('the footer is inside the drawer, which starts closed, so the names are not prominent', () => {
    const { drawer } = setup();
    expect(drawer.classList.contains('open')).toBe(false);
    expect(drawer.contains(drawer.querySelector('.app-team'))).toBe(true);
  });
});

describe('site selector in the top bar', () => {
  test('lists the sites by name, with the site of scenario A selected', () => {
    setup();
    const select = q('site-top');
    expect(select.tagName).toBe('SELECT');
    expect([...select.options].map((o) => [o.value, o.textContent])).toEqual([
      ['tiny-site', 'Tiny'],
      ['other', 'Other'],
    ]);
    expect(select.value).toBe('tiny-site');
  });

  test('sits to the right of the language selector and has an accessible name', () => {
    setup();
    const names = [...document.querySelector('.topbar').children].map((c) => c.className);
    expect(names.findIndex((n) => n.includes('topbar-site'))).toBe(names.findIndex((n) => n.includes('topbar-locale')) + 1);
    expect(q('site-top').getAttribute('aria-label')).toBe(es['ctl.site']);
    q('locale').value = 'en';
    q('locale').dispatchEvent(new Event('change', { bubbles: true }));
    expect(q('site-top').getAttribute('aria-label')).toBe('Site');
  });

  test('choosing a site changes the site of scenario A and leaves B alone', () => {
    const { store } = setup({
      scenarios: { A: { siteId: 'tiny-site', timeMs: T0 + 5 * HOUR }, B: { siteId: 'tiny-site', timeMs: T0 + 9 * HOUR } },
    });
    q('site-top').value = 'other';
    q('site-top').dispatchEvent(new Event('change', { bubbles: true }));
    expect(store.get().scenarios.A).toEqual({ siteId: 'other', timeMs: T0 + 5 * HOUR });
    expect(store.get().scenarios.B).toEqual({ siteId: 'tiny-site', timeMs: T0 + 9 * HOUR });
  });

  test('stays in step with the site selector of the planner, both ways', () => {
    setup();
    q('site-top').value = 'other';
    q('site-top').dispatchEvent(new Event('change', { bubbles: true }));
    expect(q('site-A').value).toBe('other');
    q('site-A').value = 'tiny-site';
    q('site-A').dispatchEvent(new Event('change', { bubbles: true }));
    expect(q('site-top').value).toBe('tiny-site');
  });

  test('picking the site that is already shown changes nothing', () => {
    const { store } = setup();
    const listener = vi.fn();
    store.subscribe(listener);
    q('site-top').dispatchEvent(new Event('change', { bubbles: true }));
    expect(listener).not.toHaveBeenCalled();
  });

  test('changing the site stops a running animation, as it does from the planner', () => {
    const { store } = setup();
    q('play-toggle').click();
    expect(store.get().playing).toBe(true);
    q('site-top').value = 'other';
    q('site-top').dispatchEvent(new Event('change', { bubbles: true }));
    expect(store.get().playing).toBe(false);
  });

  test('plays the interface click like the other selects', () => {
    const played = [];
    const store = createStore({
      scenarios: { A: { siteId: 'tiny-site', timeMs: T0 }, B: null },
      windowMs: 24 * HOUR,
      thresholds: { ...DEFAULT_THRESHOLDS },
      playing: false,
      locale: 'es',
    });
    mountInterface(document.body.appendChild(document.createElement('div')), store, siteList, sites, {
      renderTimeline: () => ({ destroy() {}, setCursor() {} }),
      audioCue: { setEnabled: (n) => n, play: (name) => played.push(name) },
    });
    q('site-top').value = 'other';
    q('site-top').dispatchEvent(new Event('change', { bubbles: true }));
    expect(played).toContain('click');
  });
});

describe('planner drawer', () => {
  test('starts closed: out of the tab order and hidden from screen readers', () => {
    const { drawer } = setup();
    expect(drawer.classList.contains('open')).toBe(false);
    expect(drawer.getAttribute('aria-hidden')).toBe('true');
    expect(drawer.hasAttribute('inert')).toBe(true);
    expect(q('panel-toggle').getAttribute('aria-checked')).toBe('false');
  });

  test('the menu opens it and the close button closes it', () => {
    const { drawer, store } = setup();
    q('panel-toggle').click();
    expect(store.get().panelOpen).toBe(true);
    expect(drawer.classList.contains('open')).toBe(true);
    expect(drawer.getAttribute('aria-hidden')).toBe('false');
    expect(drawer.hasAttribute('inert')).toBe(false);
    expect(q('panel-toggle').getAttribute('aria-checked')).toBe('true');
    q('panel-close').click();
    expect(store.get().panelOpen).toBe(false);
    expect(drawer.classList.contains('open')).toBe(false);
  });

  test('choosing the planner again in the menu closes it', () => {
    const { store } = setup();
    q('panel-toggle').click();
    q('panel-toggle').click();
    expect(store.get().panelOpen).toBe(false);
  });

  test('turning Compare on opens the planner with both scenarios; turning it off leaves the planner as it is', () => {
    const { store, drawer } = setup();
    q('compare-toggle').click();
    expect(store.get().scenarios.B).toEqual(store.get().scenarios.A);
    expect(store.get().panelOpen).toBe(true);
    expect(drawer.classList.contains('compare-open')).toBe(true);
    expect(q('compare-toggle').getAttribute('aria-checked')).toBe('true');
    expect(q('compare-toggle').textContent).toContain(es['app.compareOff']);
    q('compare-toggle').click();
    expect(store.get().scenarios.B).toBeNull();
    expect(store.get().panelOpen).toBe(true);
    expect(drawer.classList.contains('compare-open')).toBe(false);
  });

  test('Escape closes the planner when the focus is inside it, and returns the focus to the menu button', () => {
    const { store } = setup();
    q('panel-toggle').click();
    q('panel-close').focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(store.get().panelOpen).toBe(false);
    expect(document.activeElement).toBe(q('menu-toggle'));
  });

  test('Escape does not close the planner when the focus is elsewhere', () => {
    const { store } = setup();
    q('panel-toggle').click();
    document.body.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(store.get().panelOpen).toBe(true);
  });

  test('the drawer has a heading and an accessible name', () => {
    const { drawer } = setup();
    expect(drawer.querySelector('h2').textContent).toBe(es['ui.panelTitle']);
    expect(drawer.getAttribute('aria-label')).toBe(es['ui.panelTitle']);
    expect(q('panel-close').getAttribute('aria-label')).toBe(es['ui.panelClose']);
  });

  test('the planner no longer carries the title or the toolbar', () => {
    const { drawer } = setup();
    expect(drawer.querySelector('h1')).toBeNull();
    expect(drawer.querySelector('[data-testid="sound-toggle"]')).toBeNull();
    expect(drawer.querySelector('[data-testid="play-toggle"]')).toBeNull();
  });
});

describe('player bar', () => {
  test('shows the moment of scenario A and a line over all the calculated time', () => {
    setup();
    expect(q('seek-time').textContent).toBe('2026-01-01 05:00 UTC');
    const seek = q('seek');
    expect(seek.type).toBe('range');
    expect(seek.min).toBe('0');
    expect(seek.max).toBe('47'); // one step per hour of the 48 hours of data
    expect(seek.value).toBe('5');
    expect(seek.getAttribute('aria-valuetext')).toBe('2026-01-01 05:00 UTC');
    expect(seek.getAttribute('aria-label')).toBe(es['player.seek']);
  });

  test('the play button is a triangle that becomes a pause sign while playing, with its name and state', () => {
    const { store } = setup();
    const button = q('play-toggle');
    expect(button.querySelector('.icon-play')).not.toBeNull();
    expect(button.getAttribute('aria-label')).toBe(es['app.play']);
    button.click();
    expect(store.get().playing).toBe(true);
    expect(button.querySelector('.icon-pause')).not.toBeNull();
    expect(button.querySelector('.icon-play')).toBeNull();
    expect(button.getAttribute('aria-label')).toBe(es['app.pause']);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    expect(store.get().playing).toBe(false);
    expect(button.querySelector('.icon-play')).not.toBeNull();
  });

  test('has four skip buttons: back a day, back an hour, forward an hour, forward a day, in that order', () => {
    setup();
    const bar = document.querySelector('.playbar');
    const ids = [...bar.querySelectorAll('[data-testid]')].map((n) => n.dataset.testid);
    expect(ids.slice(0, 5)).toEqual(['skip-back-day', 'skip-back-hour', 'play-toggle', 'skip-fwd-hour', 'skip-fwd-day']);
    expect(q('skip-back-day').getAttribute('aria-label')).toBe(es['player.back1d']);
    expect(q('skip-fwd-hour').getAttribute('aria-label')).toBe(es['player.fwd1h']);
  });

  test('the skip buttons move the time by an hour or a day and stop at the ends of the data', () => {
    const { store } = setup();
    q('skip-fwd-hour').click();
    expect(store.get().scenarios.A.timeMs).toBe(T0 + 6 * HOUR);
    q('skip-back-hour').click();
    q('skip-back-hour').click();
    expect(store.get().scenarios.A.timeMs).toBe(T0 + 4 * HOUR);
    q('skip-fwd-day').click();
    expect(store.get().scenarios.A.timeMs).toBe(T0 + 28 * HOUR);
    q('skip-fwd-day').click(); // 52 h would pass the end
    expect(store.get().scenarios.A.timeMs).toBe(LAST);
    q('skip-back-day').click();
    q('skip-back-day').click();
    expect(store.get().scenarios.A.timeMs).toBe(T0);
  });

  test('moving the line sets the time, the label and the filled part of the line', () => {
    const { store } = setup();
    const seek = q('seek');
    seek.value = '30';
    seek.dispatchEvent(new Event('input', { bubbles: true }));
    expect(store.get().scenarios.A.timeMs).toBe(T0 + 30 * HOUR);
    expect(q('seek-time').textContent).toBe('2026-01-02 06:00 UTC');
    expect(parseFloat(seek.style.getPropertyValue('--progress'))).toBeCloseTo((30 / 47) * 100, 3);
  });

  test('the line follows the animation and the other controls', () => {
    const { store } = setup();
    store.set({ scenarios: { A: { siteId: 'tiny-site', timeMs: T0 + 12 * HOUR }, B: null } });
    expect(q('seek').value).toBe('12');
    q('skip-fwd-hour').click();
    expect(q('seek').value).toBe('13');
  });

  test('in compare mode the line moves A and B together, keeping the gap between their dates', () => {
    const { store } = setup({ scenarios: { A: { siteId: 'tiny-site', timeMs: T0 + 5 * HOUR }, B: { siteId: 'tiny-site', timeMs: T0 + 15 * HOUR } } });
    const seek = q('seek');
    seek.value = '10';
    seek.dispatchEvent(new Event('input', { bubbles: true }));
    expect(store.get().scenarios.A.timeMs).toBe(T0 + 10 * HOUR);
    expect(store.get().scenarios.B.timeMs).toBe(T0 + 20 * HOUR);
  });

  test('the speed button shows the speed and opens a menu with all five, the current one checked', () => {
    setup();
    expect(q('speed').textContent).toContain('6 h/s');
    expect(q('speed').getAttribute('aria-haspopup')).toBe('menu');
    const options = [...document.querySelectorAll('[data-testid^="speed-"]')];
    expect(options.map((o) => o.textContent.trim())).toEqual(['1 h/s', '6 h/s', '1 d/s', '7 d/s', '30 d/s']);
    expect(options.map((o) => o.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false', 'false']);
    expect(options.every((o) => o.getAttribute('role') === 'menuitemradio')).toBe(true);
  });

  test('choosing a speed updates the button even while paused, and the check mark moves', () => {
    const { ui } = setup();
    q('speed').click();
    q(`speed-${7 * 86_400_000}`).click();
    expect(ui.playback.speedMs).toBe(7 * 86_400_000);
    expect(q('speed').textContent).toContain('7 d/s');
    expect(q(`speed-${7 * 86_400_000}`).getAttribute('aria-checked')).toBe('true');
    expect(q(`speed-${6 * 3_600_000}`).getAttribute('aria-checked')).toBe('false');
    expect(document.querySelector('.pb-speed .menu-list').hidden).toBe(true);
  });

  test('the speed button label follows the language', () => {
    setup();
    q('locale').value = 'en';
    q('locale').dispatchEvent(new Event('change', { bubbles: true }));
    expect(q('speed').getAttribute('aria-label')).toBe('Animation speed: 6 h/s');
  });

  test('the bar is a labelled group at the bottom of the page', () => {
    setup();
    const bar = document.querySelector('.playbar');
    expect(bar.tagName).toBe('FOOTER');
    expect(bar.getAttribute('role')).toBe('group');
  });
});

describe('yearMarks / formatMoment', () => {
  test('marks the first of January of each year strictly inside the calculated range', () => {
    const marks = yearMarks(Date.UTC(2026, 0, 1), Date.UTC(2030, 11, 31, 23));
    expect(marks.map((m) => m.year)).toEqual([2027, 2028, 2029, 2030]);
    expect(marks[0].percent).toBeCloseTo((365 / 1825.96) * 100, 1);
    for (let i = 1; i < marks.length; i++) expect(marks[i].percent).toBeGreaterThan(marks[i - 1].percent);
    expect(marks.at(-1).percent).toBeLessThan(100);
  });

  test('a short range has no marks, and a range that starts on a January 1st does not mark its own start', () => {
    expect(yearMarks(T0, LAST)).toEqual([]);
    expect(yearMarks(Date.UTC(2026, 0, 1), Date.UTC(2027, 5, 1)).map((m) => m.year)).toEqual([2027]);
  });

  test('formats a moment as a UTC date and time', () => {
    expect(formatMoment(Date.UTC(2027, 0, 14, 8, 30))).toBe('2027-01-14 08:30 UTC');
  });
});

describe('icons', () => {
  test('every icon is an svg hidden from assistive technology and drawn in the text colour', () => {
    for (const name of ICON_NAMES) {
      const svg = icon(name);
      expect(svg.tagName.toLowerCase()).toBe('svg');
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('stroke')).toBe('currentColor');
      expect(svg.classList.contains(`icon-${name}`)).toBe(true);
      expect(svg.querySelector('path, circle, rect')).not.toBeNull();
    }
  });
});

describe('mountInterface', () => {
  test('dispose takes the bars out of the page', () => {
    const { ui } = setup();
    expect(document.querySelector('.topbar')).not.toBeNull();
    ui.dispose();
    expect(document.querySelector('.topbar')).toBeNull();
    expect(document.querySelector('.playbar')).toBeNull();
  });
});
