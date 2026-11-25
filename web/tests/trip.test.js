import { afterEach, describe, expect, test } from 'vitest';
import { setLocale } from '../src/i18n.js';
import { createSignPanel } from '../src/scene/signPanel.js';
import { createTrip, formatTripTime } from '../src/scene/trip.js';
import { loadTinySite } from './helpers.js';

afterEach(() => setLocale('es'));

describe('formatTripTime', () => {
  test('minutes and two-digit seconds', () => {
    expect(formatTripTime(0)).toBe('0:00');
    expect(formatTripTime(185)).toBe('3:05');
    expect(formatTripTime(719.6)).toBe('12:00');
  });

  test('adds hours past 60 minutes and never goes negative', () => {
    expect(formatTripTime(3723)).toBe('1:02:03');
    expect(formatTripTime(-5)).toBe('0:00');
  });
});

describe('createTrip', () => {
  test('adds up distance and time until the rover arrives', () => {
    const trip = createTrip();
    trip.addDistance(120);
    trip.addDistance(80.5);
    trip.tick(30);
    trip.tick(0.5);
    expect(trip.arrive()).toEqual({ distanceM: 200.5, seconds: 30.5 });
  });

  test('ignores negative or empty steps', () => {
    const trip = createTrip();
    trip.addDistance(-10);
    trip.tick(-1);
    expect(trip.arrive()).toEqual({ distanceM: 0, seconds: 0 });
  });

  test('the first arrival is frozen: driving on and arriving again changes nothing', () => {
    const trip = createTrip();
    trip.addDistance(100);
    trip.tick(20);
    const first = trip.arrive();
    trip.addDistance(500);
    trip.tick(100);
    expect(trip.arrive()).toBe(first);
    expect(trip.arrival()).toEqual({ distanceM: 100, seconds: 20 });
  });

  test('has no arrival until it arrives, and reset starts a new trip', () => {
    const trip = createTrip();
    expect(trip.arrival()).toBeNull();
    trip.addDistance(50);
    trip.arrive();
    trip.reset();
    expect(trip.arrival()).toBeNull();
    trip.addDistance(7);
    expect(trip.arrive().distanceM).toBe(7);
  });
});

describe('the sign shows the arrival', () => {
  const { info } = loadTinySite();

  test('a banner with the distance and the time, in the active language', () => {
    const sign = createSignPanel();
    sign.setInfo(info, 'es');
    sign.setTrip({ distanceM: 412.4, seconds: 185 });
    expect(sign.el.querySelector('.scene-sign-trip').textContent).toBe('Llegaste al módulo: 412 m en 3:05');
  });

  test('no banner without an arrival, and the banner survives a change of language', () => {
    const sign = createSignPanel();
    sign.setInfo(info, 'es');
    expect(sign.el.querySelector('.scene-sign-trip')).toBeNull();
    sign.setTrip({ distanceM: 100, seconds: 60 });
    setLocale('en');
    sign.setInfo(info, 'en');
    expect(sign.el.querySelector('.scene-sign-trip').textContent).toBe('You reached the lander: 100 m in 1:00');
  });

  test('offers a link back to the start screen to pick another site', () => {
    const sign = createSignPanel();
    sign.setInfo(info, 'es');
    sign.setTrip({ distanceM: 100, seconds: 60 });
    const link = sign.el.querySelector('a.scene-sign-again');
    expect(link.textContent).toBe('Elegir otro sitio');
    expect(link.getAttribute('href')).toBe('./inicio/index.html?lang=es');
  });
});
