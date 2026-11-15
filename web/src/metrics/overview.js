import { evaluateScenario, viability } from './scenario.js';
import { marginSeries } from './visibility.js';

const cache = new WeakMap();

/**
 * Whole-dataset statistics of a site (every sample from the first to the last hour).
 * Cached per site object, because the site data never changes once loaded.
 */
export function siteOverview(site) {
  let overview = cache.get(site);
  if (!overview) {
    const { eph } = site;
    const lastMs = eph.startMs + (eph.count - 1) * eph.stepMs;
    const m = evaluateScenario(site, eph.startMs, lastMs - eph.startMs);
    overview = {
      fromMs: eph.startMs,
      toMs: lastMs,
      sunFraction: m.sunFraction,
      earthFraction: m.earthFraction,
      longestSunMs: m.longestSunMs,
      longestDarkMs: m.longestDarkMs,
      longestEarthGapMs: m.longestEarthGapMs,
    };
    cache.set(site, overview);
  }
  return overview;
}

/**
 * The best landing windows of a given length: every start hour is scored by the
 * share of hourly samples with the Sun above the horizon (ties broken by Earth
 * visibility), and the best `count` non-overlapping windows are returned with
 * their full scenario metrics and traffic light.
 * @param {object} site
 * @param {{stayMs: number, fromMs?: number, toMs?: number, count?: number, thresholds?: object}} options
 */
export function bestWindows(site, { stayMs, fromMs, toMs, count = 5, thresholds } = {}) {
  const { eph } = site;
  const lastMs = eph.startMs + (eph.count - 1) * eph.stepMs;
  const from = Math.max(fromMs ?? eph.startMs, eph.startMs);
  const to = Math.min(toMs ?? lastMs, lastMs);
  const n = Math.max(1, Math.round(stayMs / eph.stepMs));
  const first = Math.ceil((from - eph.startMs) / eph.stepMs);
  const lastStart = Math.floor((to - eph.startMs) / eph.stepMs) - n;
  if (lastStart < first) return [];

  const sun = marginSeries(site, 'sun');
  const earth = marginSeries(site, 'earth');
  const sunSum = new Int32Array(eph.count + 1);
  const earthSum = new Int32Array(eph.count + 1);
  for (let i = 0; i < eph.count; i++) {
    sunSum[i + 1] = sunSum[i] + (sun[i] > 0 ? 1 : 0);
    earthSum[i + 1] = earthSum[i] + (earth[i] > 0 ? 1 : 0);
  }

  const candidates = [];
  for (let i = first; i <= lastStart; i++) {
    candidates.push({ i, sun: (sunSum[i + n] - sunSum[i]) / n, earth: (earthSum[i + n] - earthSum[i]) / n });
  }
  candidates.sort((a, b) => b.sun - a.sun || b.earth - a.earth || a.i - b.i);

  const picked = [];
  for (const c of candidates) {
    if (picked.length >= count) break;
    if (picked.every((p) => Math.abs(p.i - c.i) >= n)) picked.push(c);
  }
  return picked
    .sort((a, b) => a.i - b.i)
    .map((c) => {
      const startMs = eph.startMs + c.i * eph.stepMs;
      const metrics = evaluateScenario(site, startMs, n * eph.stepMs);
      return {
        startMs,
        endMs: startMs + n * eph.stepMs,
        sunFraction: c.sun,
        earthFraction: c.earth,
        metrics,
        verdict: thresholds ? viability(metrics, thresholds) : null,
      };
    });
}

/**
 * Daily light calendar: for each of `days` days from `fromMs`, which hours of the
 * day (UTC) have the Sun / Earth above the horizon. Rows are days, columns hours.
 * @returns {{days: number, sun: Uint8Array, earth: Uint8Array}} flat arrays of length days * 24
 */
export function lightCalendar(site, fromMs, days) {
  const { eph } = site;
  const sun = marginSeries(site, 'sun');
  const earth = marginSeries(site, 'earth');
  const sunCells = new Uint8Array(days * 24).fill(2); // 2 = no data
  const earthCells = new Uint8Array(days * 24).fill(2);
  for (let k = 0; k < days * 24; k++) {
    const index = Math.round((fromMs + k * 3_600_000 - eph.startMs) / eph.stepMs);
    if (index < 0 || index >= eph.count) continue;
    sunCells[k] = sun[index] > 0 ? 1 : 0;
    earthCells[k] = earth[index] > 0 ? 1 : 0;
  }
  return { days, sun: sunCells, earth: earthCells };
}

/**
 * A good opening date for the scenario: the start of the sunniest window of `stayMs`
 * (ties broken by Earth visibility) inside [fromMs, toMs], moved forward to the first
 * hour in which the Sun is up. Null when no window of that length fits.
 * @returns {number|null} timestamp in ms
 */
export function litStart(site, { stayMs, fromMs, toMs } = {}) {
  const [best] = bestWindows(site, { stayMs, fromMs, toMs, count: 1 });
  if (!best) return null;
  const { eph } = site;
  const sun = marginSeries(site, 'sun');
  const first = Math.round((best.startMs - eph.startMs) / eph.stepMs);
  const last = Math.round((best.endMs - eph.startMs) / eph.stepMs);
  for (let i = first; i < last; i++) {
    if (sun[i] > 0) return eph.startMs + i * eph.stepMs;
  }
  return best.startMs;
}
