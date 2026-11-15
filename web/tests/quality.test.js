import { describe, expect, test } from 'vitest';
import { SCALES, createQualityController } from '../src/scene/quality.js';

/** Feed `count` frames of `ms` each, advancing a fake clock; returns the scale changes in order. */
function feed(controller, clock, count, ms) {
  const changes = [];
  for (let i = 0; i < count; i++) {
    clock.now += ms;
    const next = controller.record(ms, clock.now);
    if (next !== null) changes.push(next);
  }
  return changes;
}

describe('createQualityController', () => {
  test('starts at full resolution and stays there while frames are fast', () => {
    const c = createQualityController();
    expect(c.scale).toBe(1);
    expect(feed(c, { now: 0 }, 400, 16.7)).toEqual([]);
    expect(c.scale).toBe(1);
  });

  test('lowers the resolution one step per window of slow frames, down to the minimum', () => {
    const c = createQualityController();
    const clock = { now: 0 };
    expect(feed(c, clock, 40, 40)).toEqual([SCALES[1]]);
    expect(feed(c, clock, 40, 40)).toEqual([SCALES[2]]);
    feed(c, clock, 400, 40);
    expect(c.scale).toBe(SCALES[SCALES.length - 1]);
    expect(feed(c, clock, 200, 40)).toEqual([]); // nothing lower to go to
  });

  test('does not react to a single hitch or to a hidden tab', () => {
    const c = createQualityController();
    const clock = { now: 0 };
    feed(c, clock, 39, 16.7);
    expect(c.record(900, (clock.now += 900))).toBeNull(); // ignored outlier, not counted
    expect(feed(c, clock, 200, 16.7)).toEqual([]);
    expect(c.record(0, 1)).toBeNull();
    expect(c.record(-5, 1)).toBeNull();
    expect(c.record(Number.NaN, 1)).toBeNull();
  });

  test('raises the resolution again, but only after the hold time and a good frame rate', () => {
    const c = createQualityController({ holdMs: 6000 });
    const clock = { now: 0 };
    feed(c, clock, 40, 40); // down to 0.85
    expect(c.scale).toBe(SCALES[1]);
    expect(feed(c, clock, 40, 16.7)).toEqual([]); // fast, but only ~0.7 s since the change
    clock.now += 7000;
    expect(feed(c, clock, 40, 16.7)).toEqual([SCALES[0]]);
  });

  test('backs off: if raising the resolution brings the slowness back, it waits twice as long', () => {
    const c = createQualityController({ holdMs: 6000 });
    const clock = { now: 0 };
    feed(c, clock, 40, 40); // 0.85
    clock.now += 7000;
    feed(c, clock, 40, 16.7); // back to 1
    feed(c, clock, 40, 40); // too heavy again: down, and the hold doubles to 12 s
    expect(c.scale).toBe(SCALES[1]);
    clock.now += 7000;
    expect(feed(c, clock, 40, 16.7)).toEqual([]); // 7 s is no longer enough
    clock.now += 6000;
    expect(feed(c, clock, 40, 16.7)).toEqual([SCALES[0]]);
  });

  test('the scales are decreasing and stay between a quarter of the pixels and full resolution', () => {
    for (let i = 1; i < SCALES.length; i++) expect(SCALES[i]).toBeLessThan(SCALES[i - 1]);
    expect(SCALES[0]).toBe(1);
    expect(SCALES[SCALES.length - 1] ** 2).toBeGreaterThanOrEqual(0.25);
  });
});
