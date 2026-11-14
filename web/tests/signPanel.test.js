import { afterEach, describe, expect, test } from 'vitest';
import { setLocale } from '../src/i18n.js';
import { createSignPanel } from '../src/scene/signPanel.js';
import es from '../src/strings/es.json';
import { loadTinySite } from './helpers.js';

const { info } = loadTinySite();

afterEach(() => setLocale('es'));

describe('createSignPanel', () => {
  test('starts closed and hidden from assistive technology', () => {
    const sign = createSignPanel();
    expect(sign.isOpen()).toBe(false);
    expect(sign.el.getAttribute('aria-hidden')).toBe('true');
    expect(sign.el.classList.contains('open')).toBe(false);
    expect(sign.el.getAttribute('role')).toBe('status');
  });

  test('opening exposes it and adds the open class; closing hides it again', () => {
    const sign = createSignPanel();
    sign.setOpen(true);
    expect(sign.isOpen()).toBe(true);
    expect(sign.el.getAttribute('aria-hidden')).toBe('false');
    expect(sign.el.classList.contains('open')).toBe(true);
    sign.setOpen(false);
    expect(sign.el.getAttribute('aria-hidden')).toBe('true');
  });

  test('shows the title, body and facts of the requested locale plus the close hint', () => {
    const sign = createSignPanel();
    sign.setInfo(info, 'es');
    expect(sign.el.querySelector('h3').textContent).toBe('Sitio sintético');
    expect(sign.el.querySelectorAll('li')).toHaveLength(info.sign.es.facts.length);
    expect(sign.el.textContent).toContain(es['scene.signClose']);
    sign.setInfo(info, 'en');
    expect(sign.el.querySelector('h3').textContent).toBe('Synthetic site');
  });

  test('falls back to Spanish when the site has no text in that locale', () => {
    const sign = createSignPanel();
    sign.setInfo({ ...info, sign: { es: info.sign.es } }, 'en');
    expect(sign.el.querySelector('h3').textContent).toBe('Sitio sintético');
  });

  test('re-rendering keeps the open state', () => {
    const sign = createSignPanel();
    sign.setOpen(true);
    sign.setInfo(info, 'es');
    expect(sign.isOpen()).toBe(true);
    expect(sign.el.getAttribute('aria-hidden')).toBe('false');
  });
});
