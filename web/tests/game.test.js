import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { setLocale } from '../src/i18n.js';
import { DEFAULT_THRESHOLDS } from '../src/metrics/scenario.js';
import { createStore } from '../src/state.js';
import en from '../src/strings/en.json';
import es from '../src/strings/es.json';
import { mountInterface } from '../src/ui/interface.js';
import { GAME_URL } from '../src/ui/topbar.js';
import { TUTORIAL_STEPS } from '../src/ui/tutorial.js';
import { HOUR, T0, loadTinySite } from './helpers.js';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const q = (id) => document.querySelector(`[data-testid="${id}"]`);

function mount() {
  const store = createStore({
    scenarios: { A: { siteId: 'tiny-site', timeMs: T0 + 5 * HOUR }, B: null },
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
  const site = loadTinySite();
  return mountInterface(drawer, store, [{ id: 'tiny-site', name: 'Tiny' }], new Map([['tiny-site', site]]), {
    renderTimeline: () => ({ destroy() {}, setCursor() {} }),
    audioCue: { setEnabled: (next) => next, play() {} },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  setLocale('es');
  document.body.replaceChildren();
});

describe('the game button in the top bar', () => {
  test('is a link to the game page, next to the menu, with a name in both languages', () => {
    mount();
    const link = q('game-link');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe(`${GAME_URL}?lang=es`);
    expect(link.textContent).toContain(es['app.game']);
    expect(link.getAttribute('aria-label')).toBe(es['app.gameLabel']);
    expect(link.nextElementSibling.className).toContain('topbar-menu');
    expect(link.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
    q('locale').value = 'en';
    q('locale').dispatchEvent(new Event('change', { bubbles: true }));
    expect(link.textContent).toContain(en['app.game']);
    expect(link.getAttribute('aria-label')).toBe(en['app.gameLabel']);
    expect(link.getAttribute('href')).toBe(`${GAME_URL}?lang=en`); // the game opens in the language of the page
    expect(window.localStorage.getItem('inside-moon-153.lang')).toBe('en'); // and remembers it
  });

  test('the tutorial explains it, and also the volume slider, each pointing at its control', () => {
    mount();
    const ids = TUTORIAL_STEPS.map((step) => step.id);
    expect(ids).toContain('game');
    expect(ids).toContain('volume');
    expect(ids.indexOf('volume')).toBeLessThan(ids.indexOf('sound'));
    for (const id of ['game', 'volume']) {
      const { target } = TUTORIAL_STEPS.find((step) => step.id === id);
      expect(document.querySelector(target), id).not.toBeNull();
    }
    expect(en['tutorial.game.text']).toContain('offline');
  });
});

describe('the game page', () => {
  const page = () => readFileSync(join(PUBLIC, 'juego', 'index.html'), 'utf8');

  test('the link of the top bar leads to a page that exists in the published folder', () => {
    expect(existsSync(resolve(PUBLIC, GAME_URL))).toBe(true);
  });

  test('has a way back to the main page on the intro screen and in the game bar', () => {
    const html = page();
    for (const id of ['btnBackHomeStory', 'btnBackHome']) {
      const tag = html.match(new RegExp(`<a id="${id}"[^>]*>`))?.[0];
      expect(tag, id).toBeTruthy();
      expect(tag).toContain('href="../index.html"');
    }
    // the way back from the game lands on the main page's file
    expect(existsSync(resolve(PUBLIC, 'juego', '../index.html')) || existsSync(resolve(PUBLIC, '..', 'index.html'))).toBe(true);
  });

  test('is the same game that was delivered: its title and its five missions are still there', () => {
    const html = page();
    expect(html).toContain('Misión Rescate Lunar');
    expect(html).toContain('0 / 5');
  });
});
