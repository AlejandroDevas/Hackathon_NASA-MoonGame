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

  test('shows why it matters, the site data and clickable sources when given', () => {
    const sign = createSignPanel();
    const rich = {
      ...info,
      sign: { es: { ...info.sign.es, why: 'Porque sí' }, en: info.sign.en },
      sources: ['https://www.nasa.gov/x', 'https://doi.org/10.1/abc'],
    };
    const overview = {
      fromMs: Date.UTC(2026, 0, 1),
      toMs: Date.UTC(2030, 11, 31),
      sunFraction: 0.51,
      earthFraction: 0.43,
      longestSunMs: 23 * 24 * 3_600_000,
      longestDarkMs: 20 * 24 * 3_600_000,
      longestEarthGapMs: 16 * 24 * 3_600_000,
    };
    sign.setInfo(rich, 'es', overview);
    const text = sign.el.textContent;
    expect(text).toContain('Porque sí');
    expect(text).toContain('2026–2030');
    expect(text).toContain('51 %');
    expect(text).toContain('23 d');
    const links = [...sign.el.querySelectorAll('a')];
    expect(links.map((a) => a.textContent)).toEqual(['nasa.gov', 'doi.org']);
    expect(links[0].href).toBe('https://www.nasa.gov/x');
    expect(links[0].rel).toContain('noopener');
    // facts stay the only list items
    expect(sign.el.querySelectorAll('li')).toHaveLength(info.sign.es.facts.length);
  });

  test('without data or sources it renders just the text', () => {
    const sign = createSignPanel();
    sign.setInfo(info, 'es');
    expect(sign.el.querySelector('dl')).toBeNull();
    expect(sign.el.querySelector('a')).toBeNull();
  });
});
