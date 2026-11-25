import { afterEach, describe, expect, test, vi } from 'vitest';
import { setLocale } from '../src/i18n.js';
import { createStore } from '../src/state.js';
import { createTopBar, shareLink } from '../src/ui/topbar.js';

const T = Date.UTC(2027, 8, 18, 14, 0);
const state = (extra = {}) => ({
  scenarios: { A: { siteId: 'haworth', timeMs: T }, B: null },
  locale: 'es',
  ...extra,
});

afterEach(() => {
  setLocale('es');
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('shareLink', () => {
  test('is this page with the site, the date and the language of scenario A', () => {
    const win = { location: { origin: 'https://example.org', pathname: '/moon/' } };
    expect(shareLink(state({ locale: 'en' }), win)).toBe('https://example.org/moon/?site=haworth&t=2027-09-18T14%3A00&lang=en');
  });
});

describe('the "copy link" menu item', () => {
  function setup() {
    const store = createStore({
      ...state(),
      viewMode: 'follow',
      shadowLift: false,
      lrocTexture: true,
      soundEnabled: false,
      panelOpen: false,
    });
    const sites = new Map([['haworth', { info: {} }]]);
    const top = createTopBar(store, { analysis: { open() {} }, sites, siteList: [{ id: 'haworth', name: 'Haworth' }] });
    top.refresh(store.get());
    document.body.append(top.el);
    return top;
  }
  const item = (top) => top.el.querySelector('[data-testid="share-link"]');

  test('is in the menu, named in the active language', () => {
    const top = setup();
    expect(item(top).textContent).toContain('Copiar enlace');
    expect(item(top).getAttribute('role')).toBe('menuitem');
  });

  test('copies the link and says so', async () => {
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const top = setup();
    item(top).click();
    await Promise.resolve();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain('site=haworth');
    expect(document.querySelector('.toast').textContent).toBe('Enlace copiado');
  });

  test('says so when the browser has no clipboard', async () => {
    vi.stubGlobal('navigator', {});
    const top = setup();
    item(top).click();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('.toast').textContent).toBe('No se pudo copiar el enlace');
  });

  test('the message goes away by itself', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.resolve() } });
    const top = setup();
    item(top).click();
    await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelector('.toast')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(3000);
    expect(document.querySelector('.toast')).toBeNull();
  });
});
