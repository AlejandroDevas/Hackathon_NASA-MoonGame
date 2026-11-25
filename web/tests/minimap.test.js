import { afterEach, describe, expect, test, vi } from 'vitest';
import { setLocale } from '../src/i18n.js';
import { MAP_SIZE_PX, createMinimap, mapHalfExtentM, renderTerrainTile, sceneToMap } from '../src/scene/minimap.js';
import { loadTinyTerrain, makeTerrain } from './helpers.js';

afterEach(() => {
  setLocale('es');
  vi.restoreAllMocks();
});

describe('sceneToMap', () => {
  test('the centre of the area is the centre of the map', () => {
    expect(sceneToMap(0, 0, 100, 160)).toEqual({ px: 80, py: 80 });
  });

  test('east goes right and south goes down, so north is up', () => {
    const east = sceneToMap(100, 0, 100, 160);
    const north = sceneToMap(0, -100, 100, 160); // north is -z
    expect(east).toEqual({ px: 160, py: 80 });
    expect(north).toEqual({ px: 80, py: 0 });
  });
});

describe('mapHalfExtentM', () => {
  test('half the side of the terrain', () => {
    expect(mapHalfExtentM({ rows: 1001, cols: 1001, pixelM: 5 })).toBe(2502.5);
    expect(mapHalfExtentM({ rows: 100, cols: 200, pixelM: 5 })).toBe(500);
  });
});

describe('renderTerrainTile', () => {
  // a 40x40 terrain of 5 m cells, 200 m across, centred on the observer
  const flat = makeTerrain({ rows: 40, cols: 40, observerRc: [20, 20], height: () => 10 });
  const ramp = makeTerrain({ rows: 40, cols: 40, observerRc: [20, 20], height: (r, c) => c * 1.5 });

  test('has one RGBA pixel per map cell', () => {
    expect(renderTerrainTile(flat, 32, 100)).toHaveLength(32 * 32 * 4);
  });

  test('is opaque over the terrain and transparent outside it', () => {
    const tile = renderTerrainTile(flat, 32, 150); // the map is wider than the terrain
    const alphaAt = (i, j) => tile[(j * 32 + i) * 4 + 3];
    expect(alphaAt(16, 16)).toBe(255);
    expect(alphaAt(0, 0)).toBe(0);
    expect(alphaAt(31, 31)).toBe(0);
  });

  test('slopes facing the light are brighter than slopes facing away', () => {
    // the ramp rises to the east: its surface faces west, toward the north-west light
    const rising = renderTerrainTile(ramp, 32, 100);
    const falling = renderTerrainTile(makeTerrain({ rows: 40, cols: 40, observerRc: [20, 20], height: (r, c) => (39 - c) * 1.5 }), 32, 100);
    const centre = (16 * 32 + 16) * 4;
    expect(rising[centre]).toBeGreaterThan(falling[centre]);
  });

  test('never produces colours outside 0-255 on real-looking terrain', () => {
    const tile = renderTerrainTile(loadTinyTerrain(), 48);
    expect(tile.some((v) => v > 0)).toBe(true);
    expect(tile.every((v) => v >= 0 && v <= 255)).toBe(true);
  });
});

describe('createMinimap', () => {
  function recordingContext() {
    const calls = [];
    const proxy = new Proxy(
      {},
      {
        get: (_, name) => (name === 'calls' ? calls : (...args) => calls.push([name, ...args])),
        set: () => true,
      },
    );
    return proxy;
  }

  test('is an image with a label in the active language', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const map = createMinimap();
    map.refreshTexts();
    expect(map.el.getAttribute('role')).toBe('img');
    expect(map.el.getAttribute('aria-label')).toContain('Minimapa');
    setLocale('en');
    map.refreshTexts();
    expect(map.el.getAttribute('aria-label')).toContain('Minimap');
  });

  test('without a canvas context it draws nothing and does not fail', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const map = createMinimap();
    map.setTerrain(loadTinyTerrain(), []);
    expect(() => map.update({ x: 10, z: 10, headingDeg: 45 })).not.toThrow();
  });

  test('can be hidden and shown', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const map = createMinimap();
    map.setHidden(true);
    expect(map.el.hidden).toBe(true);
    map.setHidden(false);
    expect(map.el.hidden).toBe(false);
  });

  test('draws again only when the rover moved or turned', () => {
    const ctx = recordingContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    globalThis.ImageData ??= class {
      constructor(data, w, h) {
        Object.assign(this, { data, width: w, height: h });
      }
    };
    const map = createMinimap();
    map.setTerrain(loadTinyTerrain(), [{ id: 'high', x: 5, z: 5 }]);
    const clears = () => ctx.calls.filter((c) => c[0] === 'clearRect').length;
    map.update({ x: 50, z: 50, headingDeg: 0 });
    expect(clears()).toBe(1);
    map.update({ x: 50.1, z: 50.1, headingDeg: 0.3 }); // too small a change to show
    expect(clears()).toBe(1);
    map.update({ x: 53, z: 50, headingDeg: 0 }); // moved
    expect(clears()).toBe(2);
    map.update({ x: 53, z: 50, headingDeg: 20 }); // turned
    expect(clears()).toBe(3);
  });

  test('the map is square and of a fixed size', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const canvas = createMinimap().el.querySelector('canvas');
    expect(canvas.width).toBe(MAP_SIZE_PX);
    expect(canvas.height).toBe(MAP_SIZE_PX);
  });
});
