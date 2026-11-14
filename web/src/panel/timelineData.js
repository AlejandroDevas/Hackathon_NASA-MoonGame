import { horizonAt, indexAt } from '../metrics/visibility.js';

/**
 * Data for the elevation chart: [time (s), sunEl, sunHorizon, earthEl, earthHorizon].
 * "Horizon" is the terrain elevation in the body's own direction, so a body is
 * visible whenever its line is above its horizon line.
 * @returns {Array<number[]>} uPlot aligned data
 */
export function timelineData(site, fromMs, toMs) {
  const { eph, horizon } = site;
  const lastMs = eph.startMs + (eph.count - 1) * eph.stepMs;
  const first = Math.ceil(indexAt(eph, fromMs));
  const last = Math.floor(indexAt(eph, Math.min(toMs, lastMs)));
  const n = Math.max(last - first + 1, 0);

  const time = new Array(n);
  const sunEl = new Array(n);
  const sunHorizon = new Array(n);
  const earthEl = new Array(n);
  const earthHorizon = new Array(n);
  for (let k = 0; k < n; k++) {
    const i = first + k;
    time[k] = (eph.startMs + i * eph.stepMs) / 1000;
    sunEl[k] = eph.sunEl[i];
    sunHorizon[k] = horizonAt(horizon, eph.sunAz[i]);
    earthEl[k] = eph.earthEl[i];
    earthHorizon[k] = horizonAt(horizon, eph.earthAz[i]);
  }
  return [time, sunEl, sunHorizon, earthEl, earthHorizon];
}
