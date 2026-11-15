import * as THREE from 'three';

/**
 * A stylised Earth for the sky. The continents are coarse hand-placed outlines
 * (longitude, latitude in degrees) rasterised with noise on top, and the clouds are
 * procedural: recognisable at the 1.9 degree size the planet has over the lunar horizon,
 * but NOT NASA imagery and not accurate coastlines.
 */
export const EARTH_WIDTH = 512;
export const EARTH_HEIGHT = 256;

const LAND = [
  // North America
  [[-168, 66], [-140, 70], [-95, 72], [-80, 73], [-62, 60], [-56, 52], [-67, 45], [-76, 38], [-81, 31], [-80, 25], [-85, 30], [-97, 26], [-97, 20], [-90, 21], [-87, 21], [-83, 10], [-78, 8], [-86, 12], [-92, 15], [-105, 20], [-110, 24], [-114, 31], [-117, 32], [-124, 40], [-124, 48], [-135, 58], [-150, 60], [-165, 60]],
  // South America
  [[-78, 9], [-72, 12], [-62, 10], [-52, 5], [-50, 0], [-35, -5], [-39, -14], [-41, -22], [-48, -26], [-58, -35], [-62, -40], [-66, -47], [-70, -52], [-74, -52], [-73, -40], [-71, -30], [-70, -18], [-76, -14], [-81, -5], [-80, 2], [-77, 8]],
  // Greenland
  [[-73, 78], [-60, 82], [-30, 83], [-20, 76], [-22, 70], [-40, 64], [-50, 62], [-58, 75]],
  // Europe and Asia
  [[-10, 36], [-9, 43], [-2, 44], [-4, 48], [2, 51], [8, 54], [10, 58], [5, 62], [15, 69], [25, 71], [40, 68], [60, 70], [80, 73], [105, 77], [140, 72], [160, 70], [180, 68], [180, 64], [165, 60], [155, 57], [142, 52], [135, 43], [128, 35], [122, 30], [120, 22], [108, 18], [106, 10], [100, 13], [103, 2], [98, 8], [92, 22], [88, 22], [80, 15], [77, 8], [73, 17], [68, 24], [57, 25], [57, 20], [52, 16], [43, 12], [35, 28], [32, 31], [36, 36], [28, 36], [26, 40], [23, 37], [19, 40], [16, 38], [12, 44], [8, 44], [3, 43], [-1, 37]],
  // Africa
  [[-17, 21], [-10, 30], [-6, 36], [10, 37], [11, 33], [20, 31], [32, 31], [34, 28], [38, 20], [43, 12], [51, 12], [40, -3], [40, -15], [35, -24], [32, -29], [20, -35], [18, -33], [12, -18], [13, -6], [9, 3], [-8, 4], [-15, 11], [-17, 15]],
  // Australia
  [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -26], [150, -37], [141, -38], [135, -34], [116, -35], [114, -27]],
  // Japan, Great Britain, Madagascar, Borneo, New Zealand
  [[130, 31], [135, 34], [141, 40], [142, 45], [140, 38], [133, 33]],
  [[-5, 50], [0, 51], [1, 53], [-3, 58], [-6, 56]],
  [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]],
  [[109, 2], [117, 7], [119, 1], [116, -3], [111, -3]],
  [[172, -34], [178, -38], [174, -42], [167, -46], [170, -41]],
];

function inside(polygon, lon, lat) {
  let isIn = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) isIn = !isIn;
  }
  return isIn;
}

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

/** Smooth noise in [0, 1) that wraps horizontally (longitude), summed over `octaves` octaves. */
function fbm(width, height, baseCells, octaves, seed) {
  const random = mulberry32(seed);
  const out = new Float32Array(width * height);
  let amplitude = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const cx = baseCells * 2 ** o;
    const cy = Math.max(2, Math.round((baseCells / 2) * 2 ** o));
    const lattice = new Float32Array(cx * (cy + 1));
    for (let i = 0; i < lattice.length; i++) lattice[i] = random();
    for (let y = 0; y < height; y++) {
      const fy = (y / (height - 1)) * cy;
      const y0 = Math.min(Math.floor(fy), cy - 1);
      const ty = fy - y0;
      for (let x = 0; x < width; x++) {
        const fx = (x / width) * cx;
        const x0 = Math.floor(fx);
        const tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const sy = ty * ty * (3 - 2 * ty);
        const at = (px, py) => lattice[py * cx + (px % cx)];
        const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
        const bottom = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
        out[y * width + x] += (top * (1 - sy) + bottom * sy) * amplitude;
      }
    }
    total += amplitude;
    amplitude *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

const mix = (a, b, f) => a + (b - a) * f;
const mixColor = (a, b, f) => [mix(a[0], b[0], f), mix(a[1], b[1], f), mix(a[2], b[2], f)];
const smoothstep = (lo, hi, v) => {
  const f = Math.min(Math.max((v - lo) / (hi - lo), 0), 1);
  return f * f * (3 - 2 * f);
};

const OCEAN_DEEP = [14, 46, 104];
const OCEAN_SHALLOW = [30, 86, 150];
const FOREST = [58, 104, 52];
const DESERT = [176, 150, 100];
const TUNDRA = [138, 140, 120];
const ICE = [236, 240, 245];

/**
 * How much cloud covers each texel, 0..0.9: procedural noise, thicker in the mid latitudes
 * and at the equator. Row 0 is the north pole.
 */
export function cloudCover(width = EARTH_WIDTH, height = EARTH_HEIGHT) {
  const clouds = fbm(width, height, 8, 5, 91);
  const cover = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const lat = 90 - (y / (height - 1)) * 180;
    const band = 0.72 + 0.3 * Math.cos((lat * Math.PI) / 30) * Math.cos((lat * Math.PI) / 90);
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      cover[i] = smoothstep(0.4, 0.68, clouds[i] * band + (clouds[i] - 0.5) * 0.4) * 0.9;
    }
  }
  return cover;
}

/**
 * RGBA bytes (equirectangular: u = (longitude + 180) / 360, v from the north pole down)
 * of oceans, land, polar ice and clouds. Deterministic.
 * @returns {Uint8Array}
 */
export function earthPixels(width = EARTH_WIDTH, height = EARTH_HEIGHT, { clouds: withClouds = true } = {}) {
  const coastNoise = fbm(width, height, 12, 4, 31);
  const climate = fbm(width, height, 6, 3, 57);
  const cover = withClouds ? cloudCover(width, height) : null;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const lat = 90 - (y / (height - 1)) * 180;
    for (let x = 0; x < width; x++) {
      const lon = (x / width) * 360 - 180;
      const i = y * width + x;
      // wobble the sampled position a little so the coastlines are not straight segments
      const jitter = (coastNoise[i] - 0.5) * 7;
      const onLand = LAND.some((polygon) => inside(polygon, lon + jitter, lat + jitter * 0.6)) || lat < -68 + (coastNoise[i] - 0.5) * 5;
      let color;
      if (onLand) {
        const aLat = Math.abs(lat);
        // dry belts in the subtropics, broken into patches by the climate noise instead of straight bands
        const belt = smoothstep(12, 24, aLat) * (1 - smoothstep(36, 48, aLat));
        const dry = belt * smoothstep(0.38, 0.58, climate[i] + (belt - 0.5) * 0.12);
        color = mixColor(FOREST, DESERT, dry);
        color = mixColor(color, TUNDRA, smoothstep(52, 66, aLat));
        const shade = 0.88 + coastNoise[i] * 0.24;
        color = color.map((c) => c * shade);
        color = mixColor(color, ICE, smoothstep(66, 74, aLat) * (lat < 0 ? 1 : 0.55));
      } else {
        color = mixColor(OCEAN_DEEP, OCEAN_SHALLOW, 0.25 + 0.5 * coastNoise[i]);
        color = mixColor(color, ICE, smoothstep(76, 84, Math.abs(lat)));
      }
      if (cover) color = mixColor(color, [250, 250, 252], cover[i]);
      pixels.set([color[0], color[1], color[2], 255], i * 4);
    }
  }
  return pixels;
}

/** Rows reversed: a DataTexture's first row is v = 0, the south pole, while earthPixels() starts at the north pole. */
export function flipRows(pixels, width, height) {
  const out = new Uint8Array(pixels.length);
  const stride = width * 4;
  for (let y = 0; y < height; y++) out.set(pixels.subarray(y * stride, (y + 1) * stride), (height - 1 - y) * stride);
  return out;
}

let cachedEarth = null;
let cachedClouds = null;

function configure(texture, name, anisotropy) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  texture.name = name;
  return texture;
}

/**
 * The procedural Earth (no clouds: they are a separate shell). Used while NASA's image
 * loads, or if it cannot. A new texture each call (a world disposes its own).
 */
export function createEarthTexture() {
  cachedEarth ??= flipRows(earthPixels(EARTH_WIDTH, EARTH_HEIGHT, { clouds: false }), EARTH_WIDTH, EARTH_HEIGHT);
  return configure(new THREE.DataTexture(cachedEarth, EARTH_WIDTH, EARTH_HEIGHT, THREE.RGBAFormat), 'earth', 4);
}

/** White RGBA with the cloud cover as alpha (row 0 = north pole, like earthPixels). */
export function cloudPixels(width = EARTH_WIDTH, height = EARTH_HEIGHT) {
  const cover = cloudCover(width, height);
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < cover.length; i++) pixels.set([252, 252, 255, Math.round(cover[i] * 255)], i * 4);
  return pixels;
}

/** Transparent cloud layer for a second, slightly larger sphere over the Earth. */
export function createCloudTexture() {
  cachedClouds ??= flipRows(cloudPixels(), EARTH_WIDTH, EARTH_HEIGHT);
  return configure(new THREE.DataTexture(cachedClouds, EARTH_WIDTH, EARTH_HEIGHT, THREE.RGBAFormat), 'clouds', 4);
}

/**
 * NASA's Blue Marble Next Generation image (January 2004 base map, resized to 2048 x 1024,
 * deep ocean recoloured: see public/textures/README.md). Resolves to the texture, or to null
 * (with a console warning) when it cannot be loaded, so the procedural Earth stays.
 * @param {string} url
 */
export async function loadEarthImage(url) {
  try {
    const texture = await new THREE.TextureLoader().loadAsync(url);
    return configure(texture, 'earth-nasa-blue-marble', 8);
  } catch (error) {
    console.warn('NASA Earth image could not be loaded; keeping the procedural Earth.', error);
    return null;
  }
}
