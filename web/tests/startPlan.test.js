// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { startFor } from '../src/scene/startPlan.js';
import { parseTerrain, terrainFingerprint } from '../src/scene/terrainData.js';
import { START_DISTANCE_M, planStart } from '../src/scene/traversal.js';
import { loadTinySite } from './helpers.js';

const SITES = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sites');

function bufferOf(path) {
  const bytes = readFileSync(path);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe('terrainFingerprint', () => {
  test('is deterministic and depends on the bytes and the length', () => {
    const a = new Uint16Array([1, 2, 3, 4]).buffer;
    const b = new Uint16Array([1, 2, 3, 4]).buffer;
    const c = new Uint16Array([1, 2, 3, 5]).buffer;
    const d = new Uint16Array([1, 2, 3, 4, 0, 0]).buffer;
    expect(terrainFingerprint(a)).toBe(terrainFingerprint(b));
    expect(terrainFingerprint(a)).not.toBe(terrainFingerprint(c));
    expect(terrainFingerprint(a)).not.toBe(terrainFingerprint(d));
    expect(terrainFingerprint(a)).toMatch(/^[0-9a-f]+:8$/);
  });

  test('a single changed height changes it', () => {
    const base = new Uint16Array(1000).fill(500);
    const changed = base.slice();
    changed[777] = 501;
    expect(terrainFingerprint(base.buffer)).not.toBe(terrainFingerprint(changed.buffer));
  });
});

describe('startFor', () => {
  const site = loadTinySite();
  const shipped = { x: 999, z: -999, headingDeg: 12, distanceM: 400, limitDeg: 33, reachable: true, fingerprint: 'abc:1' };

  test('uses the plan that came with the site when its fingerprint matches the terrain', () => {
    const plan = startFor({ ...site, start: shipped, terrainFingerprint: 'abc:1' });
    expect(plan).toMatchObject({ x: 999, z: -999, headingDeg: 12, distanceM: 400, limitDeg: 33, reachable: true });
    expect(plan.route).toEqual([]);
  });

  test('ignores a stale plan, or a missing one, and works the start out itself', () => {
    const expected = planStart(site.terrain, { x: 0, z: 0 }, START_DISTANCE_M);
    for (const extra of [
      { start: shipped, terrainFingerprint: 'other:1' }, // computed from a different terrain
      { start: shipped, terrainFingerprint: null }, // fingerprint unknown
      { start: null, terrainFingerprint: 'abc:1' }, // nothing shipped
    ]) {
      const plan = startFor({ ...site, ...extra });
      expect(plan.x).toBe(expected.x);
      expect(plan.z).toBe(expected.z);
      expect(plan.limitDeg).toBe(expected.limitDeg);
      expect(plan.x).not.toBe(999);
    }
  });
});

describe('the start.json files that ship with the sites', () => {
  const list = JSON.parse(readFileSync(join(SITES, 'index.json'), 'utf8'));

  test.each(list.map((s) => s.id))(
    '%s: is up to date with its terrain and equals what the search finds',
    (id) => {
      const info = JSON.parse(readFileSync(join(SITES, id, 'info.json'), 'utf8'));
      const buffer = bufferOf(join(SITES, id, info.terrain.file));
      const start = JSON.parse(readFileSync(join(SITES, id, 'start.json'), 'utf8'));
      // if this fails, the terrain changed: run `npm --prefix web run plan-starts`
      expect(start.fingerprint).toBe(terrainFingerprint(buffer));
      const found = planStart(parseTerrain(buffer, info.terrain), { x: 0, z: 0 }, START_DISTANCE_M);
      expect(start.x).toBeCloseTo(found.x, 6);
      expect(start.z).toBeCloseTo(found.z, 6);
      expect(start.headingDeg).toBeCloseTo(found.headingDeg, 6);
      expect(start.limitDeg).toBe(found.limitDeg);
      expect(start.reachable).toBe(found.reachable);
    },
    120_000,
  );
});
