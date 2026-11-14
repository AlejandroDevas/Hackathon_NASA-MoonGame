import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { createRobot, stepRobot } from '../src/scene/robot.js';
import { parseTerrain } from '../src/scene/terrainData.js';
import { planStart } from '../src/scene/traversal.js';

const SITES = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sites');
const sites = JSON.parse(readFileSync(join(SITES, 'index.json'), 'utf8'));
const EXPECTED_LIMIT = { 'site01-connecting-ridge': 15, 'site04-shackleton-rim': 35 };

function loadTerrain(id) {
  const info = JSON.parse(readFileSync(join(SITES, id, 'info.json'), 'utf8'));
  const bytes = readFileSync(join(SITES, id, info.terrain.file));
  return parseTerrain(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), info.terrain);
}

/** Drive the planned route node by node with the real robot rules; returns what happened. */
function autopilot(terrain, plan) {
  let robot = createRobot(terrain, plan.x, plan.z, plan.headingDeg);
  let blockedRun = 0;
  let longestBlockedRun = 0;
  for (const node of plan.route.slice(1)) {
    for (let guard = 0; guard < 400 && Math.hypot(node.x - robot.x, node.z - robot.z) > 3; guard++) {
      const headingDeg = (((Math.atan2(node.x - robot.x, -(node.z - robot.z)) * 180) / Math.PI) + 360) % 360;
      robot = stepRobot({ ...robot, headingDeg }, { forward: 1, turn: 0, boost: false }, terrain, 0.1, plan.limitDeg);
      blockedRun = robot.blocked ? blockedRun + 1 : 0;
      longestBlockedRun = Math.max(longestBlockedRun, blockedRun);
      if (longestBlockedRun > 20) return { robot, longestBlockedRun };
    }
  }
  return { robot, longestBlockedRun };
}

describe('autopilot on the real sites', () => {
  test.each(sites.map((s) => s.id))('%s: the planned route can be driven to the sign', (id) => {
    const terrain = loadTerrain(id);
    const plan = planStart(terrain, { x: 0, z: 0 }, 400);
    expect(plan.reachable).toBe(true);
    expect(Math.abs(plan.distanceM - 400)).toBeLessThanOrEqual(40);
    expect(plan.limitDeg).toBeGreaterThanOrEqual(15);
    expect(plan.limitDeg).toBeLessThanOrEqual(45);
    if (EXPECTED_LIMIT[id]) expect(plan.limitDeg).toBe(EXPECTED_LIMIT[id]);

    const { robot, longestBlockedRun } = autopilot(terrain, plan);
    expect(longestBlockedRun).toBeLessThanOrEqual(20);
    expect(Math.hypot(robot.x, robot.z)).toBeLessThan(25); // close enough for the sign to open
  }, 60_000);
});
