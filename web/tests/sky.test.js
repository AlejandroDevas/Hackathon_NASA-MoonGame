import { describe, expect, test } from 'vitest';
import { directionFromAzEl, skyAt } from '../src/scene/sky.js';
import { HOUR, T0, loadTinySite, makeSite } from './helpers.js';

const tiny = loadTinySite();

describe('directionFromAzEl', () => {
  test('cardinal directions in scene axes (x east, y up, z south)', () => {
    const east = directionFromAzEl(90, 0);
    expect([east.x, east.y, east.z]).toEqual([expect.closeTo(1, 9), expect.closeTo(0, 9), expect.closeTo(0, 9)]);
    expect(directionFromAzEl(0, 0).z).toBeCloseTo(-1, 9); // north is -z
    expect(directionFromAzEl(180, 0).z).toBeCloseTo(1, 9);
    expect(directionFromAzEl(0, 90).y).toBeCloseTo(1, 9);
  });

  test('is a unit vector', () => {
    const d = directionFromAzEl(123, 17);
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 9);
  });
});

describe('skyAt', () => {
  test('values at a sample', () => {
    const sky = skyAt(tiny, T0 + 5 * HOUR);
    expect(sky.sun.azDeg).toBeCloseTo(90, 5);
    expect(sky.sun.elDeg).toBeCloseTo(2.898, 3);
    expect(sky.earth.azDeg).toBeCloseTo(180, 5);
    expect(sky.earth.elDeg).toBeCloseTo(5, 5);
  });

  test('interpolates linearly between samples', () => {
    expect(skyAt(tiny, T0 + 11.5 * HOUR).earth.elDeg).toBeCloseTo(2, 5);
  });

  test('interpolates the azimuth through north (359 -> 1), not through south', () => {
    const site = makeSite({ sunEl: [0, 0], sunAz: [359, 1] });
    const az = skyAt(site, T0 + 0.5 * HOUR).sun.azDeg;
    expect(Math.min(az, 360 - az)).toBeLessThan(1e-3);
    expect(az).toBeGreaterThanOrEqual(0);
    expect(az).toBeLessThan(360);
  });

  test('a sun below the geometric horizon is returned as is', () => {
    const site = makeSite({ sunEl: [-3, -3] });
    expect(skyAt(site, T0).sun.elDeg).toBeCloseTo(-3, 6);
  });

  test('times outside the data are clamped instead of throwing', () => {
    const last = skyAt(tiny, T0 + 47 * HOUR);
    expect(skyAt(tiny, Date.UTC(2031, 0, 1))).toEqual(last);
    expect(skyAt(tiny, Date.UTC(2020, 0, 1))).toEqual(skyAt(tiny, T0));
  });
});
