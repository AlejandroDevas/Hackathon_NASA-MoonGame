import { contains, heightAt, slopeDegAt } from './terrainData.js';

export const MAX_SLOPE_DEG = 25;
export const ROBOT_SPEED = 4; // m/s
export const BOOST_FACTOR = 3;
export const TURN_RATE_DEG_S = 90;
export const MAX_SUBSTEP_M = 1;
export const SIGN_OPEN_M = 25;
export const SIGN_CLOSE_M = 40;

const RAD = Math.PI / 180;
const wrap360 = (deg) => ((deg % 360) + 360) % 360;

/**
 * @typedef {{x: number, z: number, y: number, headingDeg: number, blocked: boolean,
 *   blockedBy: 'slope' | 'edge' | null}} RobotState
 * `blockedBy` says why the last step stopped: 'slope' (steeper than the limit) or
 * 'edge' (outside the terrain, or no finite slope there: boundary or missing heights).
 * Heading is an azimuth: 0 faces north (-z), 90 faces east (+x).
 */

/** @returns {RobotState} */
export function createRobot(terrain, x, z, headingDeg) {
  return { x, z, y: heightAt(terrain, x, z), headingDeg: wrap360(headingDeg), blocked: false, blockedBy: null };
}

/**
 * Advance the robot by `dtSeconds`. Movement is done in sub-steps of at most
 * MAX_SUBSTEP_M so a long frame cannot jump over a steep or missing area; the
 * robot stops at the last valid point when the next one is outside the terrain
 * or steeper than `limitDeg` (MAX_SLOPE_DEG unless the site sets its own).
 * @param {RobotState} state
 * @param {{forward: number, turn: number, boost: boolean}} input
 * @returns {RobotState}
 */
export function stepRobot(state, input, terrain, dtSeconds, limitDeg = MAX_SLOPE_DEG) {
  const headingDeg = wrap360(state.headingDeg + input.turn * TURN_RATE_DEG_S * dtSeconds);
  const speed = ROBOT_SPEED * (input.boost ? BOOST_FACTOR : 1);
  const distance = input.forward * speed * dtSeconds;
  const steps = Math.ceil(Math.abs(distance) / MAX_SUBSTEP_M);
  const dx = Math.sin(headingDeg * RAD);
  const dz = -Math.cos(headingDeg * RAD);

  let { x, z } = state;
  let blockedBy = null;
  for (let i = 0; i < steps; i++) {
    const step = distance / steps;
    const nextX = x + dx * step;
    const nextZ = z + dz * step;
    if (!contains(terrain, nextX, nextZ)) {
      blockedBy = 'edge';
      break;
    }
    const slope = slopeDegAt(terrain, nextX, nextZ);
    if (!Number.isFinite(slope)) {
      blockedBy = 'edge';
      break;
    }
    if (slope > limitDeg) {
      blockedBy = 'slope';
      break;
    }
    x = nextX;
    z = nextZ;
  }
  return { x, z, y: heightAt(terrain, x, z), headingDeg, blocked: blockedBy !== null, blockedBy };
}

/** Third-person camera: 12 m behind, 6 m above, looking 1.5 m above the robot. */
export function followCamera(state) {
  const dx = Math.sin(state.headingDeg * RAD);
  const dz = -Math.cos(state.headingDeg * RAD);
  return {
    position: { x: state.x - dx * 12, y: state.y + 6, z: state.z - dz * 12 },
    target: { x: state.x, y: state.y + 1.5, z: state.z },
  };
}

/** Sign visibility with hysteresis: opens below 25 m, closes above 40 m. */
export function nextSignOpen(open, distanceM) {
  return open ? distanceM <= SIGN_CLOSE_M : distanceM < SIGN_OPEN_M;
}
