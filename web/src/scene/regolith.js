import * as THREE from 'three';

/** Side (px) of the tileable regolith texture and the ground distance (m) one tile covers. */
export const REGOLITH_SIZE = 256;
export const REGOLITH_TILE_M = 32;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (f) => f * f * (3 - 2 * f);

/** Periodic value noise in [0, 1): the lattice wraps every `cells` cells, so tiles join seamlessly. */
function valueNoise(size, cells, random) {
  const lattice = new Float32Array(cells * cells);
  for (let i = 0; i < lattice.length; i++) lattice[i] = random();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cells;
    const y0 = Math.floor(fy);
    const ty = smooth(fy - y0);
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells;
      const x0 = Math.floor(fx);
      const tx = smooth(fx - x0);
      const at = (cx, cy) => lattice[(cy % cells) * cells + (cx % cells)];
      const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
      const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
      out[y * size + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return out;
}

/**
 * Greyscale height field of a patch of lunar regolith: layered noise (fine grain on
 * top of broader undulation) plus small bowl-shaped craters with a raised rim.
 * It tiles seamlessly and is deterministic for a given seed. Values in [0, 1].
 * @returns {Float32Array} size * size heights
 */
export function regolithHeights(size = REGOLITH_SIZE, seed = 20260101) {
  const random = mulberry32(seed);
  const heights = new Float32Array(size * size);
  let amplitude = 0.5;
  let total = 0;
  for (const cells of [4, 8, 16, 32, 64]) {
    const layer = valueNoise(size, cells, random);
    for (let i = 0; i < heights.length; i++) heights[i] += layer[i] * amplitude;
    total += amplitude;
    amplitude *= 0.55;
  }
  for (let i = 0; i < heights.length; i++) heights[i] /= total;

  for (let n = 0; n < 46; n++) {
    const cx = random() * size;
    const cy = random() * size;
    const radius = 3 + random() ** 2 * 20;
    const depth = 0.1 + random() * 0.12;
    const reach = Math.ceil(radius * 1.35);
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const d = Math.hypot(dx, dy) / radius;
        if (d > 1.35) continue;
        const profile = d < 1 ? -depth * (1 - d * d) : depth * 0.35 * (1 - (d - 1) / 0.35) ** 2;
        const x = (((Math.round(cx) + dx) % size) + size) % size;
        const y = (((Math.round(cy) + dy) % size) + size) % size;
        heights[y * size + x] += profile;
      }
    }
  }
  let min = Infinity;
  let max = -Infinity;
  for (const h of heights) {
    min = Math.min(min, h);
    max = Math.max(max, h);
  }
  for (let i = 0; i < heights.length; i++) heights[i] = (heights[i] - min) / (max - min || 1);
  return heights;
}

/** RGBA bytes: grey brightness between 0.6 and 1 of the height field, so it never darkens the terrain much. */
export function regolithPixels(size = REGOLITH_SIZE, seed = 20260101) {
  const heights = regolithHeights(size, seed);
  const pixels = new Uint8Array(size * size * 4);
  for (let i = 0; i < heights.length; i++) {
    const v = Math.round((0.6 + 0.4 * heights[i]) * 255);
    pixels.set([v, v, v, 255], i * 4);
  }
  return pixels;
}

/**
 * Tiling regolith texture, used both as colour variation and as a bump map so the
 * grazing polar sunlight picks out the fine grain. Procedural: it is NOT satellite imagery.
 */
export function createRegolithTexture(size = REGOLITH_SIZE, seed = 20260101) {
  const texture = new THREE.DataTexture(regolithPixels(size, seed), size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  texture.name = 'regolith';
  return texture;
}
