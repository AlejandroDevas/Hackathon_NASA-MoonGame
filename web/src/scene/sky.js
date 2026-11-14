const RAD = Math.PI / 180;

/**
 * Unit vector towards (azimuth, elevation) in scene axes: x = east, y = up, z = south.
 * Azimuth 0 = true north (-z), 90 = east, clockwise.
 */
export function directionFromAzEl(azDeg, elDeg) {
  const az = azDeg * RAD;
  const el = elDeg * RAD;
  return { x: Math.cos(el) * Math.sin(az), y: Math.sin(el), z: -Math.cos(el) * Math.cos(az) };
}

function lerp(a, b, f) {
  return a + (b - a) * f;
}

/** Linear interpolation of azimuths along the shortest arc; result in [0, 360). */
function lerpAzimuth(a, b, f) {
  const delta = ((((b - a) % 360) + 540) % 360) - 180;
  return (((a + delta * f) % 360) + 360) % 360;
}

/**
 * Sun and Earth position (azimuth, elevation in degrees) at `timeMs`, interpolated
 * between samples. A time outside the data is clamped to its first/last sample.
 */
export function skyAt(site, timeMs) {
  const { eph } = site;
  const raw = (timeMs - eph.startMs) / eph.stepMs;
  const index = Math.min(Math.max(raw, 0), eph.count - 1);
  const i0 = Math.min(Math.floor(index), eph.count - 2);
  const i1 = Math.min(i0 + 1, eph.count - 1);
  const f = index - i0;
  const body = (el, az) => ({
    azDeg: lerpAzimuth(az[i0], az[i1], f),
    elDeg: lerp(el[i0], el[i1], f),
  });
  return { sun: body(eph.sunEl, eph.sunAz), earth: body(eph.earthEl, eph.earthAz) };
}
