const DEG = Math.PI / 180;
const SYNODIC_MONTH_DAYS = 29.530588;
/** A new Moon: 2000-01-06 18:14 UTC. */
const NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);
const DAY_MS = 86_400_000;

/** Moon phase as a fraction of the synodic month: 0 = new Moon (full Earth from the Moon), 0.5 = full Moon. */
export function moonPhaseFraction(timeMs) {
  const cycles = (timeMs - NEW_MOON_MS) / (SYNODIC_MONTH_DAYS * DAY_MS);
  return cycles - Math.floor(cycles);
}

/** Longitude (degrees east) where the Sun is overhead at `timeMs`: noon UTC is the Greenwich meridian (equation of time ignored). */
export function subsolarLongitudeDeg(timeMs) {
  const utcHours = (((timeMs % DAY_MS) + DAY_MS) % DAY_MS) / 3_600_000;
  return -15 * (utcHours - 12);
}

/**
 * Longitude on Earth that faces the Moon at `timeMs`, in degrees east in [-180, 180).
 * The Moon lies `phase * 360` degrees east of the Sun, and local solar time grows eastwards,
 * so the sub-lunar point is that many degrees east of the sub-solar point. Mean phase
 * only: good to a few degrees of longitude, which is far below what the 1.9 degree disc shows.
 */
export function subLunarLongitudeDeg(timeMs) {
  const lon = subsolarLongitudeDeg(timeMs) + moonPhaseFraction(timeMs) * 360;
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/**
 * Yaw (radians, about +Y) that turns the Earth sphere so longitude `lonDeg` faces the
 * observer at the scene origin. The sphere's UVs put longitude 0 on +X and east towards -Z
 * (three.js SphereGeometry with u = (lon + 180) / 360), and the polar axis stays vertical.
 * @param {{x: number, y: number, z: number}} earthDirection unit vector from the observer to the Earth
 */
export function earthYaw(earthDirection, lonDeg) {
  // direction (from the Earth's centre) that must show the sub-lunar meridian: back at the observer
  const gamma = Math.atan2(earthDirection.z, -earthDirection.x); // angle of the vector (-x, -z) in the (cos g, -sin g) convention
  return gamma - lonDeg * DEG;
}
