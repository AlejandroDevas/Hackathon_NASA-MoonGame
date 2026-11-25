import { afterEach, describe, expect, test } from 'vitest';
import { setLocale } from '../src/i18n.js';
import { createSkyReadout } from '../src/scene/skyReadout.js';
import { makeSite } from './helpers.js';

afterEach(() => setLocale('es'));

// flat horizon at 2 deg; the Sun is 5 deg up and the Earth 1 deg up (below the 2 deg horizon)
const site = makeSite({ sunEl: [5, 5], earthEl: [1, 1], sunRadius: 0.27, earthRadius: 0.5 });
site.horizon = Float32Array.from(new Array(360).fill(2));
const sky = { sun: { azDeg: 41.4, elDeg: 5 }, earth: { azDeg: 145, elDeg: 1 } };

describe('createSkyReadout', () => {
  test('one row for the Sun and one for the Earth, with azimuth, height and horizon', () => {
    const readout = createSkyReadout();
    readout.update(site, sky);
    const [sun, earth] = readout.el.querySelectorAll('.scene-sky-row');
    expect(sun.textContent).toBe('Sol · acimut 41° · altura 5.0° · horizonte del terreno 2.0° · sobre el horizonte');
    expect(earth.textContent).toContain('Tierra · acimut 145° · altura 1.0°');
  });

  test('a body whose disc is still over the horizon counts as visible, one clearly under it does not', () => {
    const readout = createSkyReadout();
    readout.update(site, sky); // Earth: 1 deg + 0.5 deg radius < 2 deg horizon
    const [sun, earth] = readout.el.querySelectorAll('.scene-sky-row');
    expect(sun.classList.contains('hidden-body')).toBe(false);
    expect(earth.classList.contains('hidden-body')).toBe(true);
    expect(earth.textContent).toContain('bajo el horizonte');
    readout.update(site, { ...sky, earth: { azDeg: 145, elDeg: 1.8 } }); // 1.8 + 0.5 > 2: the upper edge shows
    expect(earth.classList.contains('hidden-body')).toBe(false);
  });

  test('the horizon figure sits in its own span so narrow screens can hide it', () => {
    const readout = createSkyReadout();
    readout.update(site, sky);
    expect(readout.el.querySelector('.scene-sky-hz').textContent).toBe(' · horizonte del terreno 2.0°');
  });

  test('follows the language', () => {
    const readout = createSkyReadout();
    setLocale('en');
    readout.update(site, sky);
    expect(readout.el.querySelector('.scene-sky-sun').textContent).toBe('Sun · azimuth 41° · height 5.0° · terrain horizon 2.0° · above the horizon');
  });
});
