// Precomputes where the rover starts and each site's slope limit (planStart), so the browser does not have to
// search for it every time a site is shown (about half a second of blocking work).
//
//   npm --prefix web run plan-starts
//
// Writes web/public/sites/<id>/start.json next to terrain.bin. Run it again whenever a terrain.bin changes;
// the file records a fingerprint of the terrain it was computed from, and the app ignores a stale one.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTerrain, terrainFingerprint } from '../src/scene/terrainData.js';
import { START_DISTANCE_M, planStart } from '../src/scene/traversal.js';

const SITES = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sites');
const list = JSON.parse(readFileSync(join(SITES, 'index.json'), 'utf8'));

for (const { id } of list) {
  const info = JSON.parse(readFileSync(join(SITES, id, 'info.json'), 'utf8'));
  if (!info.terrain) {
    console.log(`${id}: no terrain, skipped`);
    continue;
  }
  const bytes = readFileSync(join(SITES, id, info.terrain.file));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const terrain = parseTerrain(buffer, info.terrain);
  const started = performance.now();
  const plan = planStart(terrain, { x: 0, z: 0 }, START_DISTANCE_M);
  const start = {
    x: plan.x,
    z: plan.z,
    headingDeg: plan.headingDeg,
    distanceM: plan.distanceM,
    limitDeg: plan.limitDeg,
    reachable: plan.reachable,
    fingerprint: terrainFingerprint(buffer),
  };
  writeFileSync(join(SITES, id, 'start.json'), `${JSON.stringify(start, null, 2)}\n`);
  console.log(`${id}: limit ${start.limitDeg} deg, start ${start.distanceM.toFixed(0)} m away, ${(performance.now() - started).toFixed(0)} ms`);
}
