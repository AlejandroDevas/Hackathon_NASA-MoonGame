// @vitest-environment node
import { describe, expect, test } from 'vitest';
import {
  createRegolithNormalTexture,
  createRegolithTexture,
  regolithHeights,
  regolithNormalPixels,
  regolithPixels,
} from '../src/scene/regolith.js';
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

describe('regolith normal map', () => {
  test('is a tangent-space map: every normal points up and has unit length', () => {
    const pixels = regolithNormalPixels(SIZE, 3);
    expect(pixels).toHaveLength(SIZE * SIZE * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      const n = [pixels[i], pixels[i + 1], pixels[i + 2]].map((b) => (b / 255) * 2 - 1);
      expect(n[2]).toBeGreaterThan(0);
      expect(Math.hypot(...n)).toBeCloseTo(1, 1);
      expect(pixels[i + 3]).toBe(255);
    }
  });

  test('leans against the slope: where the ground rises towards the east the normal tilts towards the west', () => {
    // u runs east, so the normal's x is minus the height gradient along u
    const heights = regolithHeights(SIZE, 3);
    const pixels = regolithNormalPixels(SIZE, 3);
    let checked = 0;
    for (let y = 1; y < SIZE - 1; y++) {
      for (let x = 1; x < SIZE - 1; x++) {
        const rise = heights[y * SIZE + x + 1] - heights[y * SIZE + x - 1];
        if (Math.abs(rise) < 0.05) continue;
        const nx = (pixels[(y * SIZE + x) * 4] / 255) * 2 - 1;
        expect(Math.sign(nx)).toBe(-Math.sign(rise));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  test('tiles seamlessly: the normals at the two edges of the tile are as alike as two neighbours', () => {
    const pixels = regolithNormalPixels(SIZE, 3);
    const px = (x, y, k) => pixels[(y * SIZE + x) * 4 + k];
    let worstInside = 0;
    let worstSeam = 0;
    for (let y = 0; y < SIZE; y++) {
      for (let k = 0; k < 3; k++) {
        worstSeam = Math.max(worstSeam, Math.abs(px(0, y, k) - px(SIZE - 1, y, k)));
        for (let x = 0; x < SIZE - 1; x++) worstInside = Math.max(worstInside, Math.abs(px(x + 1, y, k) - px(x, y, k)));
      }
    }
    expect(worstSeam).toBeLessThanOrEqual(worstInside);
  });

  test('builds a repeating, mipmapped, anisotropic three.js texture', () => {
    const texture = createRegolithNormalTexture(SIZE, 5);
    expect(texture.wrapS).toBe(1000); // THREE.RepeatWrapping
    expect(texture.generateMipmaps).toBe(true);
    expect(texture.anisotropy).toBeGreaterThanOrEqual(8);
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
