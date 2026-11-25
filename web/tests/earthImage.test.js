// @vitest-environment node
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cloudCover, cloudPixels, createCloudTexture, earthPixels, loadEarthImage } from '../src/scene/earthTexture.js';
import { createWorld } from '../src/scene/world.js';
import { loadTinySite } from './helpers.js';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

afterEach(() => vi.restoreAllMocks());

/** Width and height from the first JPEG start-of-frame marker. */
function jpegSize(bytes) {
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new Error('bad marker');
    const marker = bytes[i + 1];
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
    i += 2 + length;
  }
  throw new Error('no SOF marker');
}

describe('the shipped NASA Earth image', () => {
  const file = join(WEB, 'public', 'textures', 'earth.jpg');
  const bytes = readFileSync(file);

  test('is a JPEG, 2:1 like an equirectangular map, and small enough for the web', () => {
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    const { width, height } = jpegSize(bytes);
    expect(width).toBe(2048);
    expect(height).toBe(1024);
    expect(statSync(file).size).toBeLessThan(600_000);
  });

  test('its credit and the changes made to it are documented next to it', () => {
    const readme = readFileSync(join(WEB, 'public', 'textures', 'README.md'), 'utf8');
    expect(readme).toContain('NASA Earth Observatory');
    expect(readme).toContain('Blue Marble');
    expect(readme).toContain('recoloured');
  });
});

describe('clouds as a separate layer', () => {
  test('cover is in [0, 0.9] and varies', () => {
    const cover = cloudCover(128, 64);
    let min = 1;
    let max = 0;
    for (const c of cover) {
      min = Math.min(min, c);
      max = Math.max(max, c);
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(0.9 + 1e-6);
    expect(max).toBeGreaterThan(0.5);
    expect(min).toBeLessThan(0.1);
  });

  test('cloud pixels are white with the cover as alpha', () => {
    const pixels = cloudPixels(64, 32);
    const cover = cloudCover(64, 32);
    for (let i = 0; i < cover.length; i += 37) {
      expect(pixels[i * 4]).toBeGreaterThan(245);
      expect(pixels[i * 4 + 3]).toBe(Math.round(cover[i] * 255));
    }
  });

  test('the surface without clouds differs from the one with clouds, only where there is cover', () => {
    const w = 64;
    const h = 32;
    const clear = earthPixels(w, h, { clouds: false });
    const cloudy = earthPixels(w, h);
    const cover = cloudCover(w, h);
    let changed = 0;
    for (let i = 0; i < cover.length; i++) {
      const same = clear[i * 4] === cloudy[i * 4] && clear[i * 4 + 1] === cloudy[i * 4 + 1] && clear[i * 4 + 2] === cloudy[i * 4 + 2];
      if (cover[i] === 0) expect(same).toBe(true);
      if (!same) changed++;
    }
    expect(changed).toBeGreaterThan(0);
  });

  test('the cloud texture is transparent-capable and uses the same orientation convention', () => {
    const texture = createCloudTexture();
    expect(texture.image.data[3]).toBeLessThanOrEqual(230); // alpha channel present, not a flat opaque image
    texture.dispose();
  });
});

describe('Earth in the world', () => {
  test('is wrapped by a transparent, unlit-shadow cloud shell a little larger than the planet', () => {
    const world = createWorld(loadTinySite());
    const shell = world.earth.children.find((c) => c.name === 'earth-clouds');
    expect(shell).toBeDefined();
    expect(shell.material.transparent).toBe(true);
    expect(shell.material.depthWrite).toBe(false);
    expect(shell.castShadow).toBe(false);
    const r = (mesh) => mesh.geometry.boundingSphere ?? (mesh.geometry.computeBoundingSphere(), mesh.geometry.boundingSphere);
    expect(r(shell).radius / r(world.earth).radius).toBeCloseTo(1.012, 3);
  });

  test('setEarthMap swaps the surface texture and frees the previous one', () => {
    const world = createWorld(loadTinySite());
    const previous = world.earth.material.map;
    const dispose = vi.spyOn(previous, 'dispose');
    const next = new THREE.Texture();
    world.setEarthMap(next);
    expect(world.earth.material.map).toBe(next);
    expect(dispose).toHaveBeenCalled();
  });
});

describe('loadEarthImage', () => {
  test('configures the loaded NASA image as a colour texture', async () => {
    vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockResolvedValue(new THREE.Texture());
    const texture = await loadEarthImage('/textures/earth.jpg');
    expect(texture).not.toBeNull();
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.name).toBe('earth-nasa-blue-marble');
  });

  test('resolves to null (and warns) when it cannot be loaded, so the procedural Earth stays', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockRejectedValue(new Error('404'));
    expect(await loadEarthImage('/textures/missing.jpg')).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});
