import { MAX_SLOPE_DEG } from './robot.js';
import { contains, slopeDegAt } from './terrainData.js';

const RAD = Math.PI / 180;
const SEED_RADIUS_M = 20;
const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Slope limits a site may get, lowest first; planStart picks the lowest one that is winnable. */
export const SLOPE_LADDER_DEG = [15, 20, 25, 30, 35, 40, 45];
/** Spacing (m) of the extra slope samples taken along each route edge. */
const EDGE_SAMPLE_M = 2.5;
/** A start further than this from the requested distance means the goal sits in a pocket: not winnable. */
const START_TOLERANCE_M = 40;
/** The route search asks for this much less than the robot's own limit, so a one-node corridor stays drivable. */
export const ROUTE_MARGIN_DEG = 2;

/**
 * Find where the robot can start so that `goal` is reachable without ever
 * entering terrain steeper than `limitDeg - marginDeg`: a breadth-first search over
 * nodes spaced `strideM` apart, seeded at the walkable node nearest to the goal
 * (within 20 m). A step between two nodes is only taken if the points sampled along
 * it (every 2.5 m) are also below the limit, so the route can be driven continuously. Returns the reachable node whose distance to the goal is closest
 * to `targetDistM`, facing the goal, plus the route from that node to the seed;
 * null if the goal has no walkable node nearby.
 * @returns {{x: number, z: number, headingDeg: number, distanceM: number, route: Array<{x: number, z: number}>} | null}
 */
export function findStart(terrain, goal, targetDistM, { strideM = 10, limitDeg = MAX_SLOPE_DEG, marginDeg = 0 } = {}) {
  const maxSlope = limitDeg - marginDeg;
  const edgeSlope = limitDeg - marginDeg / 2;
  const walkable = (x, z) => contains(terrain, x, z) && slopeDegAt(terrain, x, z) <= maxSlope;
  const at = (i, j) => ({ x: goal.x + i * strideM, z: goal.z + j * strideM });
  const nodeCache = new Map();
  const walkableNode = (i, j) => {
    const k = `${i},${j}`;
    let ok = nodeCache.get(k);
    if (ok === undefined) {
      const p = at(i, j);
      ok = walkable(p.x, p.z);
      nodeCache.set(k, ok);
    }
    return ok;
  };
  const edgeDrivable = (i, j, ni, nj) => {
    const a = at(i, j);
    const b = at(ni, nj);
    const segments = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / EDGE_SAMPLE_M);
    for (let k = 1; k < segments; k++) {
      const x = a.x + ((b.x - a.x) * k) / segments;
      const z = a.z + ((b.z - a.z) * k) / segments;
      if (!contains(terrain, x, z) || !(slopeDegAt(terrain, x, z) <= edgeSlope)) return false;
    }
    return true;
  };

  let seed = null;
  let seedDistance = Infinity;
  const reach = Math.ceil(SEED_RADIUS_M / strideM);
  for (let i = -reach; i <= reach; i++) {
    for (let j = -reach; j <= reach; j++) {
      const { x, z } = at(i, j);
      const d = Math.hypot(x - goal.x, z - goal.z);
      if (d <= SEED_RADIUS_M && d < seedDistance && walkable(x, z)) {
        seed = [i, j];
        seedDistance = d;
      }
    }
  }
  if (!seed) return null;

  const key = (i, j) => `${i},${j}`;
  const visited = new Set([key(...seed)]);
  const queue = [seed];
  const parent = [-1]; // index in `queue` of the node each node was reached from
  let bestIndex = 0;
  let bestGap = Infinity;
  for (let head = 0; head < queue.length; head++) {
    const [i, j] = queue[head];
    const { x, z } = at(i, j);
    const gap = Math.abs(Math.hypot(x - goal.x, z - goal.z) - targetDistM);
    if (gap < bestGap) {
      bestGap = gap;
      bestIndex = head;
    }
    for (const [di, dj] of NEIGHBOURS) {
      const next = [i + di, j + dj];
      const nextKey = key(...next);
      if (visited.has(nextKey) || !walkableNode(...next) || !edgeDrivable(i, j, ...next)) continue;
      visited.add(nextKey);
      queue.push(next);
      parent.push(head);
    }
  }

  const route = [];
  for (let index = bestIndex; index !== -1; index = parent[index]) route.push(at(...queue[index]));
  const best = route[0];
  const distanceM = Math.hypot(best.x - goal.x, best.z - goal.z);
  const east = goal.x - best.x;
  const north = -(goal.z - best.z);
  const headingDeg = (((Math.atan2(east, north) / RAD) % 360) + 360) % 360;
  return { x: best.x, z: best.z, headingDeg, distanceM, route };
}

/**
 * Pick the site's slope limit and the robot's start: the lowest limit of
 * SLOPE_LADDER_DEG with which the goal is reachable from about `targetDistM` away
 * (within 40 m, so a goal boxed into a small pocket does not count) searching with a
 * ROUTE_MARGIN_DEG margin. When no limit works it returns the goal itself with
 * `reachable: false`, so the caller can tell the player instead of leaving the
 * robot stuck without a word.
 * @returns {{x: number, z: number, headingDeg: number, distanceM: number, route: Array<{x: number, z: number}>, limitDeg: number, reachable: boolean}}
 */
export function planStart(terrain, goal, targetDistM, opts = {}) {
  for (const limitDeg of SLOPE_LADDER_DEG) {
    const start = findStart(terrain, goal, targetDistM, { ...opts, limitDeg, marginDeg: ROUTE_MARGIN_DEG });
    if (start && Math.abs(start.distanceM - targetDistM) <= START_TOLERANCE_M) return { ...start, limitDeg, reachable: true };
  }
  const last = SLOPE_LADDER_DEG[SLOPE_LADDER_DEG.length - 1];
  return { x: goal.x, z: goal.z, headingDeg: 0, distanceM: 0, route: [], limitDeg: last, reachable: false };
}
