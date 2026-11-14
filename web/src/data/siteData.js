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
 * @param {string} baseUrl folder that holds one sub-folder per site
 * @param {string} id site id
 */
export async function loadSite(baseUrl, id) {
  const dir = `${baseUrl}/${id}`;
  const info = await (await fetchOk(`${dir}/info.json`)).json();
  const horizonJson = await (await fetchOk(`${dir}/horizon.json`)).json();
  const buffer = await (await fetchOk(`${dir}/${info.ephemeris.file}`)).arrayBuffer();
  const terrain = info.terrain
    ? parseTerrain(await (await fetchOk(`${dir}/${info.terrain.file}`)).arrayBuffer(), info.terrain)
    : null;
  return {
    info,
    horizon: Float32Array.from(horizonJson.elevation_deg),
    eph: parseEphemeris(buffer, info.ephemeris),
    terrain,
  };
}
