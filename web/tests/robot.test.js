// @vitest-environment node
import { describe, expect, test } from 'vitest';
import {
  BOOST_FACTOR,
  MAX_SLOPE_DEG,
  ROBOT_SPEED,
  createRobot,
  followCamera,
  nextSignOpen,
  speedFraction,
  stepRobot,
} from '../src/scene/robot.js';
import { heightAt } from '../src/scene/terrainData.js';
import { loadTinyTerrain, makeTerrain } from './helpers.js';

const tiny = loadTinyTerrain();
const go = { forward: 1, turn: 0, boost: false };

describe('constants', () => {
  test('match the spec', () => {
    expect([MAX_SLOPE_DEG, ROBOT_SPEED, BOOST_FACTOR]).toEqual([25, 4, 3]);
  });
});

describe('stepRobot', () => {
  test('moves east on a gentle slope at 4 m/s', () => {
    const r = stepRobot(createRobot(tiny, 0, 0, 90), go, tiny, 1);
    expect(r.x).toBeCloseTo(4, 6);
    expect(r.z).toBeCloseTo(0, 6);
    expect(r.blocked).toBe(false);
    expect(r.blockedBy).toBeNull();
    expect(createRobot(tiny, 0, 0, 90).blockedBy).toBeNull();
    expect(r.y).toBeCloseTo(heightAt(tiny, r.x, r.z), 9);
  });

  test('heading 0 moves north (-z)', () => {
    const r = stepRobot(createRobot(tiny, 0, 0, 0), go, tiny, 1);
    expect(r.z).toBeCloseTo(-4, 6);
    expect(r.x).toBeCloseTo(0, 6);
  });

  test('boost triples the speed', () => {
    const r = stepRobot(createRobot(tiny, 0, 0, 90), { ...go, boost: true }, tiny, 1);
    expect(r.x).toBeCloseTo(12, 6);
  });

  test('reverse moves backwards', () => {
    const r = stepRobot(createRobot(tiny, 0, 0, 90), { ...go, forward: -1 }, tiny, 1);
    expect(r.x).toBeCloseTo(-4, 6);
  });

  test('turning 90 deg/s wraps around 360', () => {
    const r = stepRobot(createRobot(tiny, 0, 0, 350), { forward: 0, turn: 1, boost: false }, tiny, 1);
    expect(r.headingDeg).toBeCloseTo(80, 6);
    expect(r.x).toBe(0);
  });

  test('is stopped by the cliff and reports it', () => {
    const r = stepRobot(createRobot(tiny, 0, 190, 180), go, tiny, 1);
    expect(r.blocked).toBe(true);
    expect(r.blockedBy).toBe('slope');
    expect(r.z).toBeGreaterThanOrEqual(190);
    expect(r.z).toBeLessThan(198);
  });

  test('a huge frame gap does not tunnel through the cliff', () => {
    const r = stepRobot(createRobot(tiny, 0, 100, 180), { ...go, boost: true }, tiny, 60);
    expect(r.blocked).toBe(true);
    expect(r.z).toBeLessThan(198);
  });

  test('never leaves the terrain edge and stays finite', () => {
    const r = stepRobot(createRobot(tiny, 249, 0, 90), go, tiny, 5);
    expect(r.blocked).toBe(true);
    expect(r.blockedBy).toBe('edge');
    expect(r.x).toBeLessThanOrEqual(250);
    expect([r.x, r.z, r.y, r.headingDeg].every(Number.isFinite)).toBe(true);
  });

  test('does not enter cells with missing (NaN) heights', () => {
    const t = makeTerrain({
      rows: 101,
      cols: 101,
      observerRc: [50, 50],
      height: (r, c) => (c >= 60 && c <= 62 ? NaN : 0),
    });
    const r = stepRobot(createRobot(t, 0, 0, 90), go, t, 30);
    expect(r.blocked).toBe(true);
    expect(r.blockedBy).toBe('edge');
    expect(r.x).toBeLessThan(50);
    expect([r.x, r.z, r.y].every(Number.isFinite)).toBe(true);
  });

  test('without input nothing moves and it is not blocked', () => {
    const start = createRobot(tiny, 5, 5, 45);
    const r = stepRobot(start, { forward: 0, turn: 0, boost: false }, tiny, 1);
    expect(r).toEqual(start);
  });
});

describe('followCamera', () => {
  test('sits 12 m behind and 6 m above, looking 1.5 m above the robot', () => {
    const north = followCamera({ x: 10, y: 100, z: 20, headingDeg: 0 });
    expect(north.position).toEqual({ x: expect.closeTo(10, 6), y: 106, z: expect.closeTo(32, 6) });
    expect(north.target).toEqual({ x: 10, y: 101.5, z: 20 });
    const east = followCamera({ x: 0, y: 0, z: 0, headingDeg: 90 });
    expect(east.position.x).toBeCloseTo(-12, 6);
  });
});

describe('nextSignOpen', () => {
  test('opens below 25 m, closes above 40 m, keeps its state in between', () => {
    expect(nextSignOpen(false, 24)).toBe(true);
    expect(nextSignOpen(true, 30)).toBe(true);
    expect(nextSignOpen(true, 41)).toBe(false);
    expect(nextSignOpen(false, 30)).toBe(false);
  });
});

describe('stepRobot with a custom slope limit', () => {
  const twentyDegrees = makeTerrain({ rows: 101, cols: 101, observerRc: [50, 50], height: (r, c) => 1.82 * c });

  test('a 15 degree limit stops the robot on a 20 degree slope', () => {
    const r = stepRobot(createRobot(twentyDegrees, 0, 0, 90), go, twentyDegrees, 1, 15);
    expect(r.blocked).toBe(true);
    expect(r.x).toBeCloseTo(0, 6);
  });

  test('the default limit (25) lets it climb the same slope', () => {
    const r = stepRobot(createRobot(twentyDegrees, 0, 0, 90), go, twentyDegrees, 1);
    expect(r.blocked).toBe(false);
    expect(r.x).toBeCloseTo(4, 6);
  });
});

describe('speedFraction', () => {
  test('is 0 when no time has passed or the rover did not move', () => {
    expect(speedFraction(1, 0)).toBe(0);
    expect(speedFraction(0, 0.016)).toBe(0);
  });

  test('walking speed is a third of the boosted top speed', () => {
    expect(speedFraction(ROBOT_SPEED * 0.1, 0.1)).toBeCloseTo(1 / BOOST_FACTOR);
  });

  test('boosted speed is 1', () => {
    expect(speedFraction(ROBOT_SPEED * BOOST_FACTOR * 0.1, 0.1)).toBeCloseTo(1);
  });

  test('a jump far beyond the top speed (teleport on site change) counts as 0, not as flat out', () => {
    expect(speedFraction(500, 0.016)).toBe(0);
  });
});
