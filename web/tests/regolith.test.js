import { describe, expect, test } from 'vitest';
import { createRegolithTexture, regolithHeights, regolithPixels } from '../src/scene/regolith.js';
import { buildTerrainGeometry, terrainColor } from '../src/scene/terrainMesh.js';
import { loadTinySite } from './helpers.js';

const SIZE = 64;

describe('regolith texture', () => {
  test('heights are deterministic, in [0, 1] and use the whole range', () => {
    const a = regolithHeights(SIZE, 7);
    const b = regolithHeights(SIZE, 7);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Math.min(...a)).toBe(0);
    expect(Math.max(...a)).toBe(1);
    expect(Array.from(regolithHeights(SIZE, 8))).not.toEqual(Array.from(a));
  });

  test('tiles: the step across the wrap seam is as small as any step inside the tile', () => {
    const h = regolithHeights(128, 11);
    const n = 128;
    let worstInside = 0;
    let worstSeam = 0;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n - 1; x++) worstInside = Math.max(worstInside, Math.abs(h[y * n + x + 1] - h[y * n + x]));
      worstSeam = Math.max(worstSeam, Math.abs(h[y * n] - h[y * n + n - 1]));
    }
    expect(worstSeam).toBeLessThanOrEqual(worstInside * 1.01);
  });

  test('pixels are opaque greys that stay bright enough not to darken the terrain', () => {
    const pixels = regolithPixels(SIZE, 3);
    expect(pixels).toHaveLength(SIZE * SIZE * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      expect(pixels[i]).toBe(pixels[i + 1]);
      expect(pixels[i]).toBe(pixels[i + 2]);
      expect(pixels[i + 3]).toBe(255);
      expect(pixels[i]).toBeGreaterThanOrEqual(153);
    }
  });

  test('builds a repeating three.js texture', () => {
    const texture = createRegolithTexture(SIZE, 5);
    expect(texture.wrapS).toBe(1000); // THREE.RepeatWrapping
    expect(texture.image.width).toBe(SIZE);
    texture.dispose();
  });
});

describe('terrain look', () => {
  test('steeper faces are a little brighter, within the usual bounds', () => {
    const flat = terrainColor(50, 0, 100, 4, 4, 0);
    const steep = terrainColor(50, 0, 100, 4, 4, 35);
    expect(steep).toBeGreaterThan(flat);
    expect(steep).toBeLessThanOrEqual(1);
  });

  test('the terrain geometry has UVs that advance with ground distance', () => {
    const g = buildTerrainGeometry(loadTinySite().terrain, 1);
    const uv = g.attributes.uv;
    expect(uv.count).toBe(g.attributes.position.count);
    const pos = g.attributes.position;
    // two vertices 5 m apart along x differ by 5 / 32 in u
    const du = uv.getX(1) - uv.getX(0);
    const dx = pos.getX(1) - pos.getX(0);
    expect(du).toBeCloseTo(dx / 32, 5);
  });
});
