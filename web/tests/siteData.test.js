import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ensureTerrain, loadSite, parseEphemeris } from '../src/data/siteData.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function stubFetchFromDisk() {
  vi.stubGlobal('fetch', async (url) => {
    const path = join(FIXTURES, url.replace(/^\/fixtures\//, ''));
    try {
      const buf = await readFile(path);
      const bytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      return {
        ok: true,
        status: 200,
        json: async () => JSON.parse(buf.toString('utf8')),
        arrayBuffer: async () => bytes,
      };
    } catch {
      return { ok: false, status: 404 };
    }
  });
}

describe('loadSite', () => {
  beforeEach(stubFetchFromDisk);
  afterEach(() => vi.unstubAllGlobals());

  test('loads info, horizon and ephemeris of the fixture site', async () => {
    const site = await loadSite('/fixtures', 'tiny-site');
    expect(site.info.id).toBe('tiny-site');
    expect(site.eph.count).toBe(48);
    expect(site.eph.stepMs).toBe(3_600_000);
    expect(site.eph.startMs).toBe(Date.UTC(2026, 0, 1));
    expect(site.eph.sunEl[3]).toBeCloseTo(3 * Math.sin(Math.PI / 4), 4);
    expect(site.horizon).toBeInstanceOf(Float32Array);
    expect(site.horizon.length).toBe(360);
    expect(site.horizon[90]).toBe(2);
    expect(site.terrain.rows).toBe(101);
    expect(site.terrain.cols).toBe(101);
  });

  test('terrain: false loads the light data only, and ensureTerrain fetches the height map once', async () => {
    const requested = [];
    const base = globalThis.fetch;
    vi.stubGlobal('fetch', (url) => {
      requested.push(url);
      return base(url);
    });
    const site = await loadSite('/fixtures', 'tiny-site', { terrain: false });
    expect(site.eph.count).toBe(48);
    expect(site.terrain).toBeNull();
    expect(requested.some((u) => u.endsWith('terrain.bin'))).toBe(false);

    const [a, b] = await Promise.all([ensureTerrain(site), ensureTerrain(site)]);
    expect(a.rows).toBe(101);
    expect(b).toBe(a);
    expect(site.terrain).toBe(a);
    expect(await ensureTerrain(site)).toBe(a);
    expect(requested.filter((u) => u.endsWith('terrain.bin'))).toHaveLength(1);
  });

  test('ensureTerrain resolves to null for a site without terrain and retries after a failed fetch', async () => {
    expect(await ensureTerrain({ info: {}, terrain: null })).toBeNull();
    const site = { info: { terrain: { file: 'terrain.bin', rows: 101, cols: 101, min_m: 0, max_m: 1, pixel_m: 5, observer_rc: [50, 50], north_bearing_deg: 0 } }, dir: '/fixtures/nowhere', terrain: null, terrainPromise: null };
    await expect(ensureTerrain(site)).rejects.toThrow('terrain.bin');
    expect(site.terrainPromise).toBeNull();
  });

  test('a missing site throws an error naming the URL', async () => {
    await expect(loadSite('/fixtures', 'nope')).rejects.toThrow('/fixtures/nope/info.json');
  });
});

describe('parseEphemeris', () => {
  test('a buffer of the wrong size throws and mentions the expected size', () => {
    const meta = { start_utc: '2026-01-01T00:00:00Z', step_s: 3600, count: 48 };
    expect(() => parseEphemeris(new ArrayBuffer(100), meta)).toThrow('768');
  });
});
