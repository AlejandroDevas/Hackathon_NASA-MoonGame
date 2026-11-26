import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { setLocale } from '../src/i18n.js';
import { createSkyReadout } from '../src/scene/skyReadout.js';
import { makeSite } from './helpers.js';

beforeEach(() => window.localStorage.clear());
afterEach(() => setLocale('es'));

// flat horizon at 2 deg; the Sun is 5 deg up and the Earth 1 deg up (below the 2 deg horizon)
const site = makeSite({ sunEl: [5, 5], earthEl: [1, 1], sunRadius: 0.27, earthRadius: 0.5 });
site.horizon = Float32Array.from(new Array(360).fill(2));
const sky = { sun: { azDeg: 41.4, elDeg: 5 }, earth: { azDeg: 145, elDeg: 1 } };

function expanded() {
  const readout = createSkyReadout();
  readout.setExpanded(true);
  readout.update(site, sky);
  return readout;
}

describe('createSkyReadout', () => {
  test('folded by default: one short line per body, with its azimuth, height and whether it is up', () => {
    const readout = createSkyReadout();
    readout.update(site, sky);
    const [sun, earth] = readout.el.querySelectorAll('.scene-sky-row');
    expect(sun.textContent).toBe('Sol 41° · 5.0° · visible');
    expect(earth.textContent).toBe('Tierra 145° · 1.0° · oculto');
    expect(readout.el.querySelector('.scene-sky-hz')).toBeNull();
  });

  test('unfolded: azimuth, height, the horizon of the terrain and whether the body is over it, in full words', () => {
    const [sun, earth] = expanded().el.querySelectorAll('.scene-sky-row');
    expect(sun.textContent).toBe('Sol · acimut 41° · altura 5.0° · horizonte del terreno 2.0° · sobre el horizonte');
    expect(earth.textContent).toContain('Tierra · acimut 145° · altura 1.0°');
  });

  test('a body whose disc is still over the horizon counts as visible, one clearly under it does not', () => {
    const readout = expanded();
    const [sun, earth] = readout.el.querySelectorAll('.scene-sky-row');
    expect(sun.classList.contains('hidden-body')).toBe(false);
    expect(earth.classList.contains('hidden-body')).toBe(true); // 1 deg + 0.5 deg radius < 2 deg horizon
    expect(earth.textContent).toContain('bajo el horizonte');
    readout.update(site, { ...sky, earth: { azDeg: 145, elDeg: 1.8 } }); // 1.8 + 0.5 > 2: the upper edge shows
    expect(earth.classList.contains('hidden-body')).toBe(false);
  });

  test('the horizon figure sits in its own span so narrow screens can hide it', () => {
    expect(expanded().el.querySelector('.scene-sky-hz').textContent).toBe(' · horizonte del terreno 2.0°');
  });

  test('the button unfolds and folds it, says which in its name, and the choice is remembered', () => {
    const readout = createSkyReadout();
    readout.update(site, sky);
    const toggle = readout.el.querySelector('[data-testid="sky-toggle"]');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Ver más datos del cielo');
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Ver menos datos del cielo');
    expect(readout.el.querySelector('.scene-sky-hz')).not.toBeNull();
    const again = createSkyReadout(); // a later visit
    expect(again.isExpanded()).toBe(true);
    toggle.click();
    expect(createSkyReadout().isExpanded()).toBe(false);
  });

  test('follows the language', () => {
    setLocale('en');
    const readout = createSkyReadout();
    readout.update(site, sky);
    expect(readout.el.querySelector('.scene-sky-sun').textContent).toBe('Sun 41° · 5.0° · visible');
    readout.setExpanded(true);
    expect(readout.el.querySelector('.scene-sky-sun').textContent).toBe(
      'Sun · azimuth 41° · height 5.0° · terrain horizon 2.0° · above the horizon',
    );
  });
});
