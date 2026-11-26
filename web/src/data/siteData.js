import { parseTerrain, terrainFingerprint } from '../scene/terrainData.js';

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
 * The LROC tone map of a site (see data-pipeline/scripts/make_albedo.py): one byte per terrain
 * cell, 100 = the same tone as the surroundings, 0 = no information. Optional: a site without
 * one, or one that cannot be fetched, simply keeps the plain terrain colour.
 * @returns {Promise<Uint8Array|null>}
 */
async function loadAlbedo(site) {
  const meta = site.info.albedo;
  if (!meta) return null;
  try {
    const buffer = await (await fetchOk(`${site.dir}/${meta.file}`)).arrayBuffer();
    if (buffer.byteLength !== meta.rows * meta.cols) throw new Error(`${meta.file}: expected ${meta.rows * meta.cols} bytes, got ${buffer.byteLength}`);
    return new Uint8Array(buffer);
  } catch (error) {
    console.warn(`LROC tone map of ${site.info.id} could not be loaded.`, error);
    return null;
  }
}

/**
 * The precomputed rover start of a site (see scripts/plan-starts.mjs), or null when there is none.
 * It is only a shortcut: without it the app works the start out itself.
 * @returns {Promise<object|null>}
 */
async function loadStart(site) {
  try {
    const response = await fetch(`${site.dir}/start.json`);
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

/** The body of a response as one buffer, reporting how much of `totalBytes` has arrived (0..1) while it comes in. */
async function readWithProgress(response, totalBytes, report) {
  const reader = response.body?.getReader?.();
  if (!reader || !(totalBytes > 0)) return response.arrayBuffer(); // no streaming here: no progress, same result
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    report(Math.min(received / totalBytes, 0.95)); // the last bit is parsing and the optional extras
  }
  const all = new Uint8Array(received);
  let at = 0;
  for (const chunk of chunks) {
    all.set(chunk, at);
    at += chunk.length;
  }
  return all.buffer;
}

/**
 * Load the terrain height map of a site the first time it is needed (about 2 MB).
 * Resolves to the terrain, or null for a site without one; repeated calls share one request.
 * `onProgress` (optional) hears how much has arrived, 0..1, ending with 1; callers that join a request already
 * under way hear it too.
 * @param {object} site
 * @param {((fraction: number) => void) | null} [onProgress]
 * @returns {Promise<object|null>}
 */
export function ensureTerrain(site, onProgress = null) {
  if (site.terrain) {
    onProgress?.(1);
    return Promise.resolve(site.terrain);
  }
  if (!site.info.terrain) return Promise.resolve(null);
  if (onProgress) (site.terrainListeners ??= new Set()).add(onProgress);
  const report = (fraction) => site.terrainListeners?.forEach((listen) => listen(fraction));
  if (!site.terrainPromise) {
    const meta = site.info.terrain;
    site.terrainPromise = fetchOk(`${site.dir}/${meta.file}`)
      .then((response) => readWithProgress(response, meta.rows * meta.cols * 2, report))
      .then(async (buffer) => {
        const terrain = parseTerrain(buffer, site.info.terrain);
        site.terrainFingerprint = terrainFingerprint(buffer);
        [site.albedo, site.start] = await Promise.all([loadAlbedo(site), loadStart(site)]);
        site.terrain = terrain;
        report(1);
        site.terrainListeners = null;
        return site.terrain;
      })
      .catch((error) => {
        site.terrainPromise = null; // a later attempt may succeed
        site.terrainListeners = null;
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
    albedo: null,
    start: null,
    terrainFingerprint: null,
    terrainPromise: null,
  };
  if (withTerrain) await ensureTerrain(site);
  return site;
}
