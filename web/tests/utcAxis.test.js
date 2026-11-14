import { describe, expect, test } from 'vitest';
import { utcTzDate } from '../src/panel/utcAxis.js';

describe('utcTzDate', () => {
  test('a browser in UTC-5 still sees UTC wall-clock fields', () => {
    process.env.TZ = 'America/Bogota';
    const seconds = Date.UTC(2026, 0, 1, 12, 30) / 1000;
    // precondition: the process really is in UTC-5, so a plain Date would show 07:30
    expect(new Date(seconds * 1000).getHours()).toBe(7);

    const shifted = utcTzDate(seconds);
    expect(shifted.getHours()).toBe(12);
    expect(shifted.getMinutes()).toBe(30);
    expect(shifted.getDate()).toBe(1);
  });
});
