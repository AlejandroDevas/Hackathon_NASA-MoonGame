import * as THREE from 'three';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ensureTerrain } from '../src/data/siteData.js';
import { setLocale } from '../src/i18n.js';
import { DEFAULT_THRESHOLDS } from '../src/metrics/scenario.js';
import { mountPanel } from '../src/panel/panel.js';
import { createWorld } from '../src/scene/world.js';
import { ALBEDO_NEUTRAL, ALBEDO_STRENGTH, albedoFactor, applyAlbedoStrength, buildTerrainGeometry } from '../src/scene/terrainMesh.js';
import { createStore } from '../src/state.js';
import es from '../src/strings/es.json';
import { HOUR, T0, loadTinySite } from './helpers.js';

const tiny = loadTinySite();
const cells = tiny.terrain.rows * tiny.terrain.cols;

/** A tone map: neutral everywhere except a bright patch, a dark patch and a no-information corner. */
function toneMap() {
  const a = new Uint8Array(cells).fill(ALBEDO_NEUTRAL);
  const { cols } = tiny.terrain;
  a[50 * cols + 50] = 160; // bright
  a[20 * cols + 20] = 60; // dark
  a[0] = 0; // no information
  return a;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setLocale('es');
  document.body.replaceChildren();
});

describe('albedoFactor', () => {
  test('neutral is 1, no information is 1, others are the relative tone', () => {
    expect(albedoFactor(ALBEDO_NEUTRAL)).toBe(1);
    expect(albedoFactor(0)).toBe(1);
    expect(albedoFactor(150)).toBe(1.5);
    expect(albedoFactor(50)).toBe(0.5);
  });
});

describe('terrain colours with an LROC tone map', () => {
  const { cols } = tiny.terrain;
  const plain = buildTerrainGeometry(tiny.terrain, 1);
  const tinted = buildTerrainGeometry(tiny.terrain, 1, toneMap());
  const grey = (g, r, c) => g.attributes.color.array[(r * cols + c) * 3];

  test('a bright patch is lighter and a dark patch darker than the plain terrain; no information is unchanged', () => {
    expect(grey(tinted, 50, 50)).toBeGreaterThan(grey(plain, 50, 50));
    expect(grey(tinted, 20, 20)).toBeLessThan(grey(plain, 20, 20));
    expect(grey(tinted, 0, 0)).toBe(grey(plain, 0, 0));
    expect(grey(tinted, 70, 70)).toBeCloseTo(grey(plain, 70, 70), 6); // neutral
  });

  test('a map of the wrong size is ignored and the colours stay plain', () => {
    const wrong = buildTerrainGeometry(tiny.terrain, 1, new Uint8Array(10));
    expect(wrong.userData.albedo).toBeUndefined();
    expect(Array.from(wrong.attributes.color.array.slice(0, 30))).toEqual(Array.from(plain.attributes.color.array.slice(0, 30)));
  });

  test('colours always stay in [0, 1]', () => {
    for (const v of tinted.attributes.color.array) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  test('applyAlbedoStrength(0) restores the plain shade and the strength scales the effect', () => {
    const g = buildTerrainGeometry(tiny.terrain, 1, toneMap());
    applyAlbedoStrength(g, 0);
    expect(grey(g, 50, 50)).toBeCloseTo(grey(plain, 50, 50), 6);
    applyAlbedoStrength(g, 0.5);
    const half = grey(g, 50, 50);
    applyAlbedoStrength(g, 1);
    const full = grey(g, 50, 50);
    expect(half).toBeGreaterThan(grey(plain, 50, 50));
    expect(full).toBeGreaterThanOrEqual(half);
  });

  test('applyAlbedoStrength on a geometry without a tone map does nothing', () => {
    expect(() => applyAlbedoStrength(plain, 1)).not.toThrow();
  });
});

/** Grey of the terrain vertex at grid cell (r, c), at full detail (the camera is put right above the site). */
function vertexGrey(world, r, c) {
  world.updateLod(new THREE.Vector3(0, 100, 0), Infinity);
  const chunk = world.terrain.chunks.find(({ box }) => r >= box.r0 && r <= box.r1 && c >= box.c0 && c <= box.c1);
  expect(chunk.lod).toBe(0);
  const { box } = chunk;
  return chunk.mesh.geometry.attributes.color.array[((r - box.r0) * (box.c1 - box.c0 + 1) + (c - box.c0)) * 3];
}

describe('the world and the LROC switch', () => {
  test('setLrocTexture hides and shows the tint on the terrain mesh', () => {
    const world = createWorld({ ...tiny, albedo: toneMap() });
    const bright = () => vertexGrey(world, 50, 50);
    const on = bright();
    world.setLrocTexture(false);
    const off = bright();
    world.setLrocTexture(true);
    expect(off).toBeLessThan(on);
    expect(bright()).toBeCloseTo(on, 6);
    expect(ALBEDO_STRENGTH).toBeGreaterThan(1); // shown exaggerated on purpose, see terrainMesh.js
  });

  test('a site without a tone map is unaffected by the switch', () => {
    const world = createWorld({ ...tiny, albedo: null });
    const before = vertexGrey(world, 50, 50);
    world.setLrocTexture(false);
    world.setLrocTexture(true);
    expect(vertexGrey(world, 50, 50)).toBe(before);
  });
});

describe('loading the tone map with the terrain', () => {
  function stubFetch(files) {
    vi.stubGlobal('fetch', async (url) => {
      const name = url.split('/').pop();
      const body = files[name];
      if (!body) return { ok: false, status: 404 };
      return { ok: true, status: 200, arrayBuffer: async () => body.slice(0).buffer ?? body };
    });
  }
  const terrainMeta = { file: 'terrain.bin', rows: 2, cols: 2, min_m: 0, max_m: 1, pixel_m: 5, observer_rc: [0.5, 0.5], north_bearing_deg: 0 };
  const terrainBytes = new Uint16Array([0, 65535, 0, 65535]);

  test('albedo.bin is read with the terrain', async () => {
    stubFetch({ 'terrain.bin': terrainBytes, 'albedo.bin': new Uint8Array([0, 100, 120, 80]) });
    const site = { info: { id: 's', terrain: terrainMeta, albedo: { file: 'albedo.bin', rows: 2, cols: 2 } }, dir: '/x', terrain: null, albedo: null, terrainPromise: null };
    await ensureTerrain(site);
    expect(Array.from(site.albedo)).toEqual([0, 100, 120, 80]);
    expect(site.terrain.rows).toBe(2);
  });

  test('a site without a tone map keeps albedo null', async () => {
    stubFetch({ 'terrain.bin': terrainBytes });
    const site = { info: { id: 's', terrain: terrainMeta }, dir: '/x', terrain: null, albedo: null, terrainPromise: null };
    await ensureTerrain(site);
    expect(site.albedo).toBeNull();
    expect(site.terrain).not.toBeNull();
  });

  test('a missing or wrongly sized tone map does not stop the terrain from loading (it warns)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch({ 'terrain.bin': terrainBytes });
    const missing = { info: { id: 's', terrain: terrainMeta, albedo: { file: 'albedo.bin', rows: 2, cols: 2 } }, dir: '/x', terrain: null, albedo: null, terrainPromise: null };
    await ensureTerrain(missing);
    expect(missing.albedo).toBeNull();
    expect(missing.terrain).not.toBeNull();
    stubFetch({ 'terrain.bin': terrainBytes, 'albedo.bin': new Uint8Array([1, 2, 3]) });
    const wrong = { info: { id: 's', terrain: terrainMeta, albedo: { file: 'albedo.bin', rows: 2, cols: 2 } }, dir: '/x', terrain: null, albedo: null, terrainPromise: null };
    await ensureTerrain(wrong);
    expect(wrong.albedo).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('the LROC button in the panel', () => {
  const withAlbedo = { ...tiny, info: { ...tiny.info, id: 'with', albedo: { file: 'albedo.bin', rows: 101, cols: 101 } } };
  const without = { ...tiny, info: { ...tiny.info, id: 'without' } };
  const sites = new Map([['with', withAlbedo], ['without', without]]);
  const siteList = [{ id: 'with', name: 'With' }, { id: 'without', name: 'Without' }];

  function setup() {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const store = createStore({
      scenarios: { A: { siteId: 'with', timeMs: T0 + 5 * HOUR }, B: null },
      windowMs: 24 * HOUR,
      thresholds: { ...DEFAULT_THRESHOLDS },
      playing: false,
      soundEnabled: false,
      shadowLift: false,
      lrocTexture: true,
      viewMode: 'follow',
      locale: 'es',
    });
    const root = document.createElement('div');
    document.body.append(root);
    mountPanel(root, store, siteList, sites, { renderTimeline: () => ({ destroy() {}, setCursor() {} }), audioCue: null });
    return { store, root };
  }
  const button = (root) => root.querySelector('[data-testid="lroc-toggle"]');

  test('is on by default for a site that has a tone map and toggles the state', () => {
    const { store, root } = setup();
    expect(button(root).textContent).toBe(es['app.lroc']);
    expect(button(root).disabled).toBe(false);
    expect(button(root).getAttribute('aria-pressed')).toBe('true');
    button(root).click();
    expect(store.get().lrocTexture).toBe(false);
    expect(button(root).getAttribute('aria-pressed')).toBe('false');
    button(root).click();
    expect(store.get().lrocTexture).toBe(true);
  });

  test('is disabled, with an explanation, for a site outside the mosaic', () => {
    const { store, root } = setup();
    store.set({ scenarios: { A: { siteId: 'without', timeMs: T0 + 5 * HOUR }, B: null } });
    expect(button(root).disabled).toBe(true);
    expect(button(root).title).toBe(es['app.lrocNone']);
    expect(button(root).getAttribute('aria-pressed')).toBe('false');
  });
});
