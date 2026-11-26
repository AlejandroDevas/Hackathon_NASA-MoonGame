// @vitest-environment node
// Guards the catalogue of sites shipped in web/public/sites: every entry has its files, bilingual texts and a start plan.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const SITES = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sites');
const CONFIG = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data-pipeline', 'config', 'sites.json');
const index = JSON.parse(readFileSync(join(SITES, 'index.json'), 'utf8'));
const config = JSON.parse(readFileSync(CONFIG, 'utf8'));
const read = (id, file) => JSON.parse(readFileSync(join(SITES, id, file), 'utf8'));

// Regions of NASA's Artemis lists that have a 5 m LOLA DEM in PGDA (README, "Sitios de aterrizaje de Artemis").
const ARTEMIS_SITES = [
  'site01-connecting-ridge',
  'site04-shackleton-rim',
  'site06-nobile-rim-1',
  'haworth',
  'site23-malapert-massif',
  'dm2-nobile-rim-2',
  'site11-de-gerlache-rim',
  'site07-peak-near-shackleton',
  'site20-leibnitz-beta-plateau',
];

describe('sites catalogue', () => {
  test('lists the nine Artemis sites, once each', () => {
    const ids = index.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...ARTEMIS_SITES].sort());
  });

  test.each(ARTEMIS_SITES)('%s has all its data files', (id) => {
    for (const file of ['info.json', 'ephemeris.bin', 'horizon.json', 'terrain.bin', 'start.json']) {
      expect(existsSync(join(SITES, id, file)), `${id}/${file}`).toBe(true);
    }
  });

  test.each(ARTEMIS_SITES)('%s has Spanish and English texts and sources', (id) => {
    const info = read(id, 'info.json');
    for (const lang of ['es', 'en']) {
      const sign = info.sign[lang];
      expect(sign.title.length).toBeGreaterThan(3);
      expect(sign.body.length).toBeGreaterThan(40);
      expect(sign.why.length).toBeGreaterThan(40);
      expect(sign.facts.length).toBeGreaterThanOrEqual(3);
    }
    expect(info.sign.es.facts).toHaveLength(info.sign.en.facts.length);
    expect(info.sources.length).toBeGreaterThanOrEqual(3);
    for (const url of info.sources) expect(url).toMatch(/^https:\/\//);
  });

  test.each(ARTEMIS_SITES)('%s info.json matches data-pipeline/config/sites.json', (id) => {
    const info = read(id, 'info.json');
    const cfg = config.find((s) => s.id === id);
    expect(cfg, `${id} missing from sites.json`).toBeDefined();
    for (const key of ['name', 'lat_deg', 'lon_deg', 'sign', 'sources']) expect(info[key]).toEqual(cfg[key]);
  });

  test('only the sites inside the LROC mosaic (south of 85.5 S, enough coverage) carry a tone map', () => {
    const withMap = ARTEMIS_SITES.filter((id) => read(id, 'info.json').albedo);
    expect(withMap.sort()).toEqual(
      ['haworth', 'site01-connecting-ridge', 'site04-shackleton-rim', 'site07-peak-near-shackleton', 'site11-de-gerlache-rim', 'site23-malapert-massif'].sort(),
    );
    for (const id of withMap) {
      expect(existsSync(join(SITES, id, 'albedo.bin')), `${id}/albedo.bin`).toBe(true);
      expect(read(id, 'info.json').albedo.coverage).toBeGreaterThan(0.5);
    }
  });

  test.each(ARTEMIS_SITES)('%s is inside the south polar cap', (id) => {
    const { lat_deg: lat } = read(id, 'info.json');
    expect(lat).toBeLessThan(-80);
    expect(lat).toBeGreaterThanOrEqual(-90);
  });
});
