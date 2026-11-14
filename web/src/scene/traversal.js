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

/**
 * Find where the robot can start so that `goal` is reachable without ever
 * entering terrain steeper than MAX_SLOPE_DEG: a breadth-first search over
 * nodes spaced `strideM` apart, seeded at the walkable node nearest to the goal
 * (within 20 m). Returns the reachable node whose distance to the goal is closest
 * to `targetDistM`, facing the goal; null if the goal has no walkable node nearby.
 * @returns {{x: number, z: number, headingDeg: number, distanceM: number} | null}
 */
export function findStart(terrain, goal, targetDistM, { strideM = 10 } = {}) {
  const walkable = (x, z) => contains(terrain, x, z) && slopeDegAt(terrain, x, z) <= MAX_SLOPE_DEG;
  const at = (i, j) => ({ x: goal.x + i * strideM, z: goal.z + j * strideM });

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
  let best = null;
  let bestGap = Infinity;
  for (let head = 0; head < queue.length; head++) {
    const [i, j] = queue[head];
    const { x, z } = at(i, j);
    const distance = Math.hypot(x - goal.x, z - goal.z);
    const gap = Math.abs(distance - targetDistM);
    if (gap < bestGap) {
      bestGap = gap;
      best = { x, z, distanceM: distance };
    }
    for (const [di, dj] of NEIGHBOURS) {
      const next = [i + di, j + dj];
      const nextKey = key(...next);
      if (visited.has(nextKey)) continue;
      visited.add(nextKey);
      const p = at(...next);
      if (walkable(p.x, p.z)) queue.push(next);
    }
  }

  const east = goal.x - best.x;
  const north = -(goal.z - best.z);
  const headingDeg = (((Math.atan2(east, north) / RAD) % 360) + 360) % 360;
  return { ...best, headingDeg };
}
