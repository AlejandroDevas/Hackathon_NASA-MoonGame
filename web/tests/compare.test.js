import { describe, expect, test } from 'vitest';
import { diffClass, diffMetrics, renderDiff } from '../src/panel/compare.js';

const HOUR = 3_600_000;
const metrics = (over = {}) => ({
  sunFraction: 0.3,
  earthFraction: 0.7,
  longestDarkMs: 10 * HOUR,
  longestEarthGapMs: 5 * HOUR,
  ...over,
});

describe('diffMetrics', () => {
  test('is always b minus a, for the four comparable fields', () => {
    const a = metrics();
    const b = metrics({ sunFraction: 0.5, earthFraction: 0.6, longestDarkMs: 12 * HOUR, longestEarthGapMs: 2 * HOUR });
    const d = diffMetrics(a, b);
    expect(Object.keys(d).sort()).toEqual(['earthFraction', 'longestDarkMs', 'longestEarthGapMs', 'sunFraction']);
    expect(d.sunFraction).toBeCloseTo(0.2, 9);
    expect(d.earthFraction).toBeCloseTo(-0.1, 9);
    expect(d.longestDarkMs).toBe(2 * HOUR);
    expect(d.longestEarthGapMs).toBe(-3 * HOUR);
  });
});

describe('diffClass', () => {
  test('more light or Earth is better; more darkness or gap is worse', () => {
    expect(diffClass('sunFraction', 0.2)).toBe('better');
    expect(diffClass('earthFraction', -0.1)).toBe('worse');
    expect(diffClass('longestDarkMs', 2 * HOUR)).toBe('worse');
    expect(diffClass('longestEarthGapMs', -3 * HOUR)).toBe('better');
  });

  test('a negligible change is neither', () => {
    expect(diffClass('sunFraction', 0.001)).toBe('same');
    expect(diffClass('longestDarkMs', 20_000)).toBe('same');
  });
});

describe('renderDiff', () => {
  test('shows signed values with their class', () => {
    const el = document.createElement('div');
    const b = metrics({ sunFraction: 0.5, earthFraction: 0.6, longestDarkMs: 12 * HOUR, longestEarthGapMs: 2 * HOUR });
    renderDiff(el, metrics(), b);
    const cell = (key) => el.querySelector(`[data-testid="diff-${key}"]`);
    expect(cell('sunFraction').textContent).toBe('+20 pp');
    expect(cell('sunFraction').classList.contains('better')).toBe(true);
    expect(cell('earthFraction').textContent).toBe('−10 pp');
    expect(cell('longestDarkMs').textContent).toBe('+2 h');
    expect(cell('longestDarkMs').classList.contains('worse')).toBe(true);
    expect(cell('longestEarthGapMs').textContent).toBe('−3 h');
  });
});
