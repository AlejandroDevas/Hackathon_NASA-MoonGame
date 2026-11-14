import { indexAt, marginSeries } from './visibility.js';

function marginAt(margin, index) {
  const i0 = Math.floor(index);
  if (i0 >= margin.length - 1) return margin[margin.length - 1];
  const f = index - i0;
  return margin[i0] * (1 - f) + margin[i0 + 1] * f;
}

/**
 * Next time the body sets (if visible now) or rises (if hidden now), with the
 * crossing interpolated linearly between samples. Null if it does not change
 * within the data.
 * @returns {{kind: 'set'|'rise', atMs: number} | null}
 */
export function nextTransition(site, body, timeMs) {
  const { eph } = site;
  const margin = marginSeries(site, body);
  const start = indexAt(eph, timeMs);
  for (let i = Math.floor(start); i < eph.count - 1; i++) {
    const a = margin[i];
    const b = margin[i + 1];
    if (a > 0 === b > 0) continue;
    const crossing = i + a / (a - b);
    if (crossing <= start) continue;
    return { kind: a > 0 ? 'set' : 'rise', atMs: eph.startMs + crossing * eph.stepMs };
  }
  return null;
}

/**
 * Intervals in [fromMs, toMs] during which the body is visible. `toMs` is
 * clipped to the end of the data.
 * @returns {Array<{startMs: number, endMs: number}>}
 */
export function visibilityWindows(site, body, fromMs, toMs) {
  const { eph } = site;
  const margin = marginSeries(site, body);
  const lastMs = eph.startMs + (eph.count - 1) * eph.stepMs;
  const from = indexAt(eph, fromMs);
  const to = indexAt(eph, Math.min(toMs, lastMs));
  const spans = [];

  for (let i = Math.floor(from); i < Math.ceil(to); i++) {
    const lo = Math.max(i, from);
    const hi = Math.min(i + 1, to);
    if (hi <= lo) continue;
    const ma = marginAt(margin, lo);
    const mb = marginAt(margin, hi);
    let span = null;
    if (ma > 0 && mb > 0) span = [lo, hi];
    else if (ma > 0 || mb > 0) {
      const crossing = lo + ((hi - lo) * ma) / (ma - mb);
      span = ma > 0 ? [lo, crossing] : [crossing, hi];
    }
    if (!span) continue;
    const previous = spans[spans.length - 1];
    if (previous && span[0] - previous[1] < 1e-9) previous[1] = span[1];
    else spans.push(span);
  }
  return spans.map(([s, e]) => ({
    startMs: eph.startMs + s * eph.stepMs,
    endMs: eph.startMs + e * eph.stepMs,
  }));
}
