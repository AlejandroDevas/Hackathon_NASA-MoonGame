import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEphemeris } from '../src/data/siteData.js';
import { parseTerrain } from '../src/scene/terrainData.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'tiny-site');

export const HOUR = 3_600_000;
export const T0 = Date.UTC(2026, 0, 1);

/** The synthetic fixture site (see data-pipeline/lunarnav/fixture.py), read from disk. */
export function loadTinySite() {
  const info = JSON.parse(readFileSync(join(DIR, 'info.json'), 'utf8'));
  const horizon = Float32Array.from(JSON.parse(readFileSync(join(DIR, 'horizon.json'), 'utf8')).elevation_deg);
  const bytes = readFileSync(join(DIR, info.ephemeris.file));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return { info, horizon, eph: parseEphemeris(buffer, info.ephemeris), terrain: loadTinyTerrain() };
}

/** The tiny site's terrain: a 2.29 deg ramp rising east and a 30 m cliff from row 90 (south). */
export function loadTinyTerrain() {
  const info = JSON.parse(readFileSync(join(DIR, 'info.json'), 'utf8'));
  const bytes = readFileSync(join(DIR, info.terrain.file));
  return parseTerrain(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), info.terrain);
}

/** A terrain built from a function, for rotation and edge-case tests. */
export function makeTerrain({ rows, cols, pixelM = 5, observerRc, northBearingDeg = 0, height }) {
  const heights = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heights[r * cols + c] = height(r, c);
  return { rows, cols, pixelM, minM: 0, maxM: 0, observerRc, northBearingDeg, heights };
}

/** A site built from plain arrays, for edge-case tests. */
export function makeSite({ sunEl, sunAz, earthEl, earthAz, horizon, sunRadius = 0, earthRadius = 0 }) {
  const count = sunEl.length;
  return {
    info: { bodies: { sun_radius_deg: sunRadius, earth_radius_deg: earthRadius } },
    horizon: Float32Array.from(horizon ?? new Array(360).fill(0)),
    eph: {
      startMs: T0,
      stepMs: HOUR,
      count,
      sunEl: Float32Array.from(sunEl),
      sunAz: Float32Array.from(sunAz ?? new Array(count).fill(0)),
      earthEl: Float32Array.from(earthEl ?? new Array(count).fill(0)),
      earthAz: Float32Array.from(earthAz ?? new Array(count).fill(0)),
    },
  };
}
