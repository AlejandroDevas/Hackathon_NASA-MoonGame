import { START_DISTANCE_M, planStart } from './traversal.js';

/**
 * Where the rover starts and the slope limit of a site. Uses the plan shipped with the site
 * (`start.json`, from scripts/plan-starts.mjs) when it was computed from this very terrain; otherwise
 * it searches for it, which takes about half a second to a second.
 * @param {{terrain: object, start?: object|null, terrainFingerprint?: string|null}} site
 * @param {{x: number, z: number}} [goal]
 */
export function startFor(site, goal = { x: 0, z: 0 }) {
  const shipped = site.start;
  if (shipped && site.terrainFingerprint && shipped.fingerprint === site.terrainFingerprint) {
    const { x, z, headingDeg, distanceM, limitDeg, reachable } = shipped;
    return { x, z, headingDeg, distanceM, limitDeg, reachable, route: [] };
  }
  return planStart(site.terrain, goal, START_DISTANCE_M);
}
