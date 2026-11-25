// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { initialPixelRatio } from '../src/scene/pixelRatio.js';

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
