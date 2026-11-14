import { nextTransition, visibilityWindows } from './events.js';
import { indexAt, marginSeries } from './visibility.js';

export const DEFAULT_THRESHOLDS = { minSunElDeg: 0, maxDarkH: 120, maxEarthGapH: 48 };

const HOUR_MS = 3_600_000;

function interpolate(series, index) {
  const i0 = Math.floor(index);
  if (i0 >= series.length - 1) return series[series.length - 1];
  const f = index - i0;
  return series[i0] * (1 - f) + series[i0 + 1] * f;
}

function visibleMs(windows) {
  return windows.reduce((sum, w) => sum + (w.endMs - w.startMs), 0);
}

/** Longest single window among `windows`. */
function longestWindowMs(windows) {
  return windows.reduce((longest, w) => Math.max(longest, w.endMs - w.startMs), 0);
}

/** Longest stretch of [fromMs, toMs] not covered by `windows` (ends included). */
function longestGapMs(windows, fromMs, toMs) {
  let longest = 0;
  let cursor = fromMs;
  for (const w of windows) {
    longest = Math.max(longest, w.startMs - cursor);
    cursor = w.endMs;
  }
  return Math.max(longest, toMs - cursor);
}

/**
 * Metrics of one scenario: the state at `timeMs` plus statistics over
 * [timeMs, timeMs + windowMs], clipped to the data (`truncated` says so).
 */
export function evaluateScenario(site, timeMs, windowMs) {
  const { eph } = site;
  const index = indexAt(eph, timeMs);
  const lastMs = eph.startMs + (eph.count - 1) * eph.stepMs;
  const windowEndMs = Math.min(timeMs + windowMs, lastMs);
  const span = windowEndMs - timeMs;

  const sunMargin = interpolate(marginSeries(site, 'sun'), index);
  const earthMargin = interpolate(marginSeries(site, 'earth'), index);
  const sunVisible = sunMargin > 0;
  const earthVisible = earthMargin > 0;

  const sunWindows = visibilityWindows(site, 'sun', timeMs, windowEndMs);
  const earthWindows = visibilityWindows(site, 'earth', timeMs, windowEndMs);
  const fraction = (windows, visibleNow) => (span > 0 ? visibleMs(windows) / span : visibleNow ? 1 : 0);

  return {
    timeMs,
    windowEndMs,
    truncated: timeMs + windowMs > lastMs,
    sunElDeg: interpolate(eph.sunEl, index),
    earthElDeg: interpolate(eph.earthEl, index),
    sunVisible,
    earthVisible,
    nextSun: nextTransition(site, 'sun', timeMs),
    nextEarth: nextTransition(site, 'earth', timeMs),
    sunFraction: fraction(sunWindows, sunVisible),
    earthFraction: fraction(earthWindows, earthVisible),
    longestSunMs: longestWindowMs(sunWindows),
    longestDarkMs: longestGapMs(sunWindows, timeMs, windowEndMs),
    longestEarthGapMs: longestGapMs(earthWindows, timeMs, windowEndMs),
    earthWindows,
  };
}

/**
 * Traffic light: 0 failed checks = green, 1 = amber, 2 or more = red.
 * @returns {{level: 'green'|'amber'|'red', failed: Array<'sunEl'|'dark'|'earthGap'>}}
 */
export function viability(metrics, thresholds = DEFAULT_THRESHOLDS) {
  const failed = [];
  if (metrics.sunElDeg < thresholds.minSunElDeg) failed.push('sunEl');
  if (metrics.longestDarkMs > thresholds.maxDarkH * HOUR_MS) failed.push('dark');
  if (metrics.longestEarthGapMs > thresholds.maxEarthGapH * HOUR_MS) failed.push('earthGap');
  const level = failed.length === 0 ? 'green' : failed.length === 1 ? 'amber' : 'red';
  return { level, failed };
}
