import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { setLocale } from '../src/i18n.js';
import { DEFAULT_THRESHOLDS } from '../src/metrics/scenario.js';
import { createStore } from '../src/state.js';
import en from '../src/strings/en.json';
import es from '../src/strings/es.json';
import { mountInterface } from '../src/ui/interface.js';
import { HOME_URL } from '../src/ui/topbar.js';
import { HOUR, T0, loadTinySite } from './helpers.js';

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
  return mountInterface(drawer, store, [{ id: 'tiny-site', name: 'Tiny' }], new Map([['tiny-site', loadTinySite()]]), {
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

describe('the home button in the top bar', () => {
  test('is the first control, a link to the start screen with a name in both languages', () => {
    mount();
    const link = q('home-link');
    expect(link.tagName).toBe('A');
    expect(document.querySelector('.topbar').firstElementChild).toBe(link);
    expect(link.getAttribute('href')).toBe(`${HOME_URL}?lang=es`);
    expect(link.textContent).toContain(es['app.home']);
    expect(link.getAttribute('aria-label')).toBe(es['app.homeLabel']);
    expect(link.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
    q('locale').value = 'en';
    q('locale').dispatchEvent(new Event('change', { bubbles: true }));
    expect(link.textContent).toContain(en['app.home']);
    expect(link.getAttribute('aria-label')).toBe(en['app.homeLabel']);
    expect(link.getAttribute('href')).toBe(`${HOME_URL}?lang=en`); // the start screen opens in the language of the page
  });
});
