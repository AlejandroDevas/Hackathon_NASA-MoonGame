/**
 * Horizon elevation (degrees) at an azimuth, linearly interpolated and circular.
 * @param {Float32Array} horizon 360 values, index = azimuth in degrees
 */
export function horizonAt(horizon, azDeg) {
  const az = ((azDeg % 360) + 360) % 360;
  const i0 = Math.floor(az);
  const i1 = (i0 + 1) % 360;
  const f = az - i0;
  return horizon[i0] * (1 - f) + horizon[i1] * f;
}

/** Fractional sample index of `timeMs`; throws RangeError outside the ephemeris. */
export function indexAt(eph, timeMs) {
  const index = (timeMs - eph.startMs) / eph.stepMs;
  if (index < 0 || index > eph.count - 1) {
    const from = new Date(eph.startMs).toISOString();
    const to = new Date(eph.startMs + (eph.count - 1) * eph.stepMs).toISOString();
    throw new RangeError(`${new Date(timeMs).toISOString()} is outside the data range ${from} .. ${to}`);
  }
  return index;
}

const cache = new WeakMap();

/**
 * margin[i] = elevation + angular radius - horizon in the body's direction.
 * The body is visible when margin > 0.
 * @param {'sun'|'earth'} body
 */
export function marginSeries(site, body) {
  let perBody = cache.get(site);
  if (!perBody) cache.set(site, (perBody = {}));
  if (perBody[body]) return perBody[body];

  const { eph, horizon, info } = site;
  const el = body === 'sun' ? eph.sunEl : eph.earthEl;
  const az = body === 'sun' ? eph.sunAz : eph.earthAz;
  const radius = info.bodies[`${body}_radius_deg`];
  const margin = new Float32Array(eph.count);
  for (let i = 0; i < eph.count; i++) margin[i] = el[i] + radius - horizonAt(horizon, az[i]);
  return (perBody[body] = margin);
}
