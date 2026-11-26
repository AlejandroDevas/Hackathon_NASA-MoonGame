import { afterEach, describe, expect, test } from 'vitest';
import { setLocale } from '../src/i18n.js';
import { bearingDeg, createCompass, sectorOf, turnDeg } from '../src/scene/compass.js';

afterEach(() => setLocale('es'));

describe('bearingDeg', () => {
  test('scene axes: north is -z, east is +x, south +z, west -x', () => {
    expect(bearingDeg(0, -10)).toBeCloseTo(0, 6);
    expect(bearingDeg(10, 0)).toBeCloseTo(90, 6);
    expect(bearingDeg(0, 10)).toBeCloseTo(180, 6);
    expect(bearingDeg(-10, 0)).toBeCloseTo(270, 6);
    expect(bearingDeg(10, -10)).toBeCloseTo(45, 6);
  });
});

describe('turnDeg', () => {
  test('the signed angle to turn, taking the short way round', () => {
    expect(turnDeg(0, 90)).toBe(90);
    expect(turnDeg(90, 0)).toBe(-90);
    expect(turnDeg(350, 10)).toBe(20);
    expect(turnDeg(10, 350)).toBe(-20);
    expect(turnDeg(0, 180)).toBe(180);
    expect(turnDeg(123, 123)).toBe(0);
  });
});

describe('sectorOf', () => {
  test('eight sectors centred on the compass points', () => {
    expect(sectorOf(0)).toBe('N');
    expect(sectorOf(22)).toBe('N');
    expect(sectorOf(23)).toBe('NE');
    expect(sectorOf(90)).toBe('E');
    expect(sectorOf(200)).toBe('S');
    expect(sectorOf(270)).toBe('W');
    expect(sectorOf(359)).toBe('N');
    expect(sectorOf(-45)).toBe('NW');
  });
});

describe('createCompass', () => {
  const target = { x: 0, z: 0 };

  test('shows where the camera looks and a distance to the landing zone', () => {
    const compass = createCompass(document.createElement('div'));
    compass.update(92, { x: 0, z: 400 }, target);
    expect(compass.el.querySelector('.scene-compass-heading').textContent).toBe('E 092°');
    expect(compass.el.querySelector('.scene-compass-goal-text').textContent).toBe('Zona de aterrizaje · 400 m');
    expect(compass.el.querySelector('.scene-compass-goal-dist').textContent).toBe('400 m');
  });

  test('the arrow points up when the landing zone is dead ahead, and to the side it lies on otherwise', () => {
    const compass = createCompass(document.createElement('div'));
    const arrow = compass.el.querySelector('.scene-compass-arrow');
    compass.update(0, { x: 0, z: 400 }, target); // looking north, the zone is north
    expect(arrow.dataset.turn).toBe('0');
    compass.update(0, { x: -300, z: 0 }, target); // west of it, so it lies to the east: to the right
    expect(arrow.dataset.turn).toBe('90');
    compass.update(180, { x: -300, z: 0 }, target); // facing south the same zone is on the left
    expect(arrow.dataset.turn).toBe('-90');
    compass.update(0, { x: 0, z: -400 }, target); // it is behind
    expect(Math.abs(Number(arrow.dataset.turn))).toBe(180);
  });

  test('hides once the sign is open, and without a target only the heading remains', () => {
    const compass = createCompass(document.createElement('div'));
    compass.update(10, { x: 0, z: 100 }, target, true);
    expect(compass.el.hidden).toBe(true);
    compass.update(10, { x: 0, z: 100 }, null, false);
    expect(compass.el.hidden).toBe(false);
    expect(compass.el.querySelector('.scene-compass-goal').hidden).toBe(true);
  });

  test('follows the language once told to redraw', () => {
    const compass = createCompass(document.createElement('div'));
    compass.update(225, { x: 0, z: 100 }, target);
    expect(compass.el.querySelector('.scene-compass-heading').textContent).toBe('SO 225°');
    setLocale('en');
    compass.refreshTexts();
    compass.update(225, { x: 0, z: 100 }, target);
    expect(compass.el.querySelector('.scene-compass-heading').textContent).toBe('SW 225°');
    expect(compass.el.querySelector('.scene-compass-goal-text').textContent).toBe('Landing zone · 100 m');
  });

  test('is hidden from assistive technology (the landmarks have their own text list)', () => {
    expect(createCompass(document.createElement('div')).el.getAttribute('aria-hidden')).toBe('true');
  });
});
