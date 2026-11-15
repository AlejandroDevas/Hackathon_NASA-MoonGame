import { describe, expect, test } from 'vitest';
import { createPixelRatioGovernor, initialPixelRatio } from '../src/scene/pixelRatio.js';

describe('initialPixelRatio', () => {
  test('uses the screen ratio, capped at 2', () => {
    expect(initialPixelRatio(1)).toBe(1);
    expect(initialPixelRatio(1.5)).toBe(1.5);
    expect(initialPixelRatio(3)).toBe(2);
  });

  test('falls back to 1 for a missing or invalid value', () => {
    expect(initialPixelRatio(undefined)).toBe(1);
    expect(initialPixelRatio(0)).toBe(1);
    expect(initialPixelRatio(NaN)).toBe(1);
  });
});

describe('createPixelRatioGovernor', () => {
  const feed = (governor, frameMs, count) => {
    let last = null;
    for (let i = 0; i < count; i++) last = governor.record(frameMs) ?? last;
    return last;
  };

  test('keeps the ratio while the view runs smoothly', () => {
    const governor = createPixelRatioGovernor(2);
    expect(feed(governor, 16, 300)).toBeNull();
    expect(governor.ratio()).toBe(2);
  });

  test('lowers the ratio one step after a slow window', () => {
    const governor = createPixelRatioGovernor(2, { windowFrames: 10 });
    expect(feed(governor, 60, 10)).toBe(1.75);
    expect(governor.ratio()).toBe(1.75);
  });

  test('keeps lowering while it stays slow, but never below the minimum', () => {
    const governor = createPixelRatioGovernor(2, { windowFrames: 5, step: 0.5 });
    feed(governor, 80, 100);
    expect(governor.ratio()).toBe(1);
  });

  test('never raises the ratio again', () => {
    const governor = createPixelRatioGovernor(2, { windowFrames: 5 });
    feed(governor, 80, 5);
    feed(governor, 8, 200);
    expect(governor.ratio()).toBe(1.75);
  });

  test('ignores pauses such as a hidden tab', () => {
    const governor = createPixelRatioGovernor(2, { windowFrames: 5 });
    expect(feed(governor, 2000, 50)).toBeNull();
    expect(governor.ratio()).toBe(2);
  });

  test('does nothing when it already starts at the minimum', () => {
    const governor = createPixelRatioGovernor(1, { windowFrames: 5 });
    expect(feed(governor, 100, 50)).toBeNull();
  });
});
