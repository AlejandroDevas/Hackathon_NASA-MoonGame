import { parseTerrain } from '../scene/terrainData.js';

const BYTES_PER_SAMPLE = 16; // 4 float32 values

/**
 * @param {ArrayBuffer} buffer float32 LE, per sample [sunEl, sunAz, earthEl, earthAz]
 * @param {{start_utc: string, step_s: number, count: number}} meta
 */
export function parseEphemeris(buffer, meta) {
  const expected = meta.count * BYTES_PER_SAMPLE;
  if (buffer.byteLength !== expected) {
    throw new Error(
      `ephemeris.bin: expected ${expected} bytes for ${meta.count} samples, got ${buffer.byteLength}`,
    );
  }
  const raw = new Float32Array(buffer);
  const column = (offset) => {
    const out = new Float32Array(meta.count);
    for (let i = 0; i < meta.count; i++) out[i] = raw[i * 4 + offset];
    return out;
  };
  return {
    startMs: Date.parse(meta.start_utc),
    stepMs: meta.step_s * 1000,
    count: meta.count,
    sunEl: column(0),
    sunAz: column(1),
    earthEl: column(2),
    earthAz: column(3),
  };
}

async function fetchOk(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status})`);
  return response;
}

/**
 * Load the terrain height map of a site the first time it is needed (about 2 MB).
 * Resolves to the terrain, or null for a site without one; repeated calls share one request.
 * @returns {Promise<object|null>}
 */
export function ensureTerrain(site) {
  if (site.terrain) return Promise.resolve(site.terrain);
  if (!site.info.terrain) return Promise.resolve(null);
  if (!site.terrainPromise) {
    site.terrainPromise = fetchOk(`${site.dir}/${site.info.terrain.file}`)
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        site.terrain = parseTerrain(buffer, site.info.terrain);
        return site.terrain;
      })
      .catch((error) => {
        site.terrainPromise = null; // a later attempt may succeed
        throw error;
      });
  }
  return site.terrainPromise;
}

/**
 * @param {string} baseUrl folder that holds one sub-folder per site
 * @param {string} id site id
 * @param {{terrain?: boolean}} [options] `terrain: false` skips the height map; fetch it later with ensureTerrain
 */
export async function loadSite(baseUrl, id, { terrain: withTerrain = true } = {}) {
  const dir = `${baseUrl}/${id}`;
  const info = await (await fetchOk(`${dir}/info.json`)).json();
  const [horizonJson, buffer] = await Promise.all([
    fetchOk(`${dir}/horizon.json`).then((response) => response.json()),
    fetchOk(`${dir}/${info.ephemeris.file}`).then((response) => response.arrayBuffer()),
  ]);
  const site = {
    info,
    dir,
    horizon: Float32Array.from(horizonJson.elevation_deg),
    eph: parseEphemeris(buffer, info.ephemeris),
    terrain: null,
    terrainPromise: null,
  };
  if (withTerrain) await ensureTerrain(site);
  return site;
}
