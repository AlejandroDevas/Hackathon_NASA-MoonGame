import * as THREE from 'three';
import { directionFromAzEl } from './sky.js';
import { gridToScene, heightAt } from './terrainData.js';
import { earthYaw, subLunarLongitudeDeg } from './earthView.js';
import { createCloudTexture, createEarthTexture } from './earthTexture.js';
import { createGlowTexture } from './glow.js';
import { createRegolithNormalTexture, createRegolithTexture } from './regolith.js';
import { createTerrainLod } from './terrainLod.js';
import { ALBEDO_STRENGTH } from './terrainMesh.js';

const RAD = Math.PI / 180;
const SUN_LIGHT_DISTANCE_M = 6_000; // keeps the shadow frustum tight around the 5 km terrain
const BODY_DISTANCE_M = 50_000;
const STAR_DISTANCE_M = 90_000;
const RING_RADIUS_M = 6_000;
const SUN_RADIUS_DEG = 0.2666;
const EARTH_RADIUS_DEG = 0.95;
const STAR_COUNT = 4500;
const GLOW_RADIUS_DEG = 5;
/** Intensity of the ambient fill light (colour 0x1b1814) normally, and with the shadow-lift aid on (a visual aid only). */
const AMBIENT_INTENSITY = 1.6;
const SHADOW_LIFT_INTENSITY = 40;
/** Strength of the regolith normal map on the terrain. */
const REGOLITH_NORMAL_SCALE = 0.5;
/**
 * Shadow map size in texels (width, height). The map is wide and short because it is fitted to the terrain as
 * seen from the nearly horizontal Sun (see `fitShadowCamera`); the same number of texels as a 4096 x 4096 map.
 */
export const DEFAULT_SHADOW_MAP_SIZE = [8192, 2048];
/** The same fitting on a GPU whose textures cannot be 8192 texels wide. */
export const SMALL_SHADOW_MAP_SIZE = [4096, 1024];

/**
 * Half-size (m) of the square shadow camera so it covers the whole terrain: the
 * farthest corner from the scene origin, plus 100 m, rounded up to a multiple of 100.
 * (A rotated or off-centre terrain reaches further than half its side.)
 */
export function shadowFrustumHalfSize(terrain) {
  let farthest = 0;
  for (const [r, c] of [[0, 0], [0, terrain.cols - 1], [terrain.rows - 1, 0], [terrain.rows - 1, terrain.cols - 1]]) {
    const { x, z } = gridToScene(terrain, r, c);
    farthest = Math.max(farthest, Math.hypot(x, z));
  }
  return Math.ceil((farthest + 100) / 100) * 100;
}

/** The eight corners of the box that holds the terrain (its four grid corners, at the lowest and highest height). */
function terrainBoxCorners(terrain) {
  const corners = [];
  for (const [r, c] of [[0, 0], [0, terrain.cols - 1], [terrain.rows - 1, 0], [terrain.rows - 1, terrain.cols - 1]]) {
    const { x, z } = gridToScene(terrain, r, c);
    corners.push(new THREE.Vector3(x, terrain.minM, z), new THREE.Vector3(x, terrain.maxM, z));
  }
  return corners;
}

/**
 * Fit the Sun's shadow camera to the terrain as seen from the Sun. The polar Sun is almost on the horizon, so
 * the terrain is a wide, shallow strip from there: a square frustum wastes most of the shadow map on empty
 * sky, while a rectangle that follows the strip gives every texel to ground.
 * The light looks at the scene origin from `lightDistance` along `direction` (unit vector towards the Sun).
 * @param {THREE.Vector3[]} corners box corners from `terrainBoxCorners`
 * @returns {{left: number, right: number, top: number, bottom: number, near: number, far: number}}
 */
export function fitShadowCamera(corners, direction, lightDistance, marginM = 100) {
  // light space, as Matrix4.lookAt builds it: z towards the Sun, x to the right, y up
  const z = direction.clone().normalize();
  const x = new THREE.Vector3(0, 1, 0).cross(z).normalize();
  const y = z.clone().cross(x);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of corners) {
    const px = p.dot(x);
    const py = p.dot(y);
    const pz = p.dot(z);
    minX = Math.min(minX, px);
    maxX = Math.max(maxX, px);
    minY = Math.min(minY, py);
    maxY = Math.max(maxY, py);
    minZ = Math.min(minZ, pz);
    maxZ = Math.max(maxZ, pz);
  }
  return {
    left: minX - marginM,
    right: maxX + marginM,
    bottom: minY - marginM,
    top: maxY + marginM,
    near: Math.max(1, lightDistance - maxZ - marginM),
    far: lightDistance - minZ + marginM,
  };
}

/** Elevation offset (metres) of the horizon silhouette at `radiusM`, for each of 360 azimuths. */
export function horizonRingProfile(horizon, radiusM) {
  const profile = new Float32Array(360);
  for (let i = 0; i < 360; i++) profile[i] = radiusM * Math.tan(horizon[i] * RAD);
  return profile;
}

function buildHorizonRing(horizon, eyeY) {
  const profile = horizonRingProfile(horizon, RING_RADIUS_M);
  const positions = new Float32Array(361 * 2 * 3);
  for (let i = 0; i <= 360; i++) {
    const az = (i % 360) * RAD;
    const x = RING_RADIUS_M * Math.sin(az);
    const z = -RING_RADIUS_M * Math.cos(az);
    positions.set([x, eyeY + profile[i % 360], z], i * 6);
    positions.set([x, eyeY - 4_000, z], i * 6 + 3);
  }
  const indices = [];
  for (let i = 0; i < 360; i++) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: 0x14161b, side: THREE.DoubleSide }),
  );
  mesh.name = 'horizon-ring';
  return mesh;
}

function buildStars() {
  // small deterministic generator so the sky does not change between reloads
  let seed = 12345;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const y = random() * 2 - 1;
    const phi = random() * Math.PI * 2;
    const ring = Math.sqrt(1 - y * y);
    positions.set([ring * Math.cos(phi) * STAR_DISTANCE_M, y * STAR_DISTANCE_M, ring * Math.sin(phi) * STAR_DISTANCE_M], i * 3);
    const brightness = 0.45 + random() * 0.55;
    colors.set([brightness, brightness, Math.min(1, brightness * 1.03)], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const stars = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, vertexColors: true }),
  );
  stars.name = 'stars';
  return stars;
}

/**
 * The 3D world of one site, without a renderer: terrain, Sun light and disc,
 * Earth, stars and the far-horizon silhouette. `updateSky` moves the Sun and Earth.
 * @param {{terrain: import('./terrainData.js').Terrain, horizon: Float32Array}} site
 */
export function createWorld(site, { shadowMapSize = DEFAULT_SHADOW_MAP_SIZE } = {}) {
  let lightDistance = SUN_LIGHT_DISTANCE_M;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Procedural regolith grain (not imagery): colour variation plus a normal map that the grazing sunlight
  // picks out. A normal map (not a bump map) so the grain fades with distance instead of aliasing into stripes.
  const regolith = createRegolithTexture();
  const regolithNormal = createRegolithNormalTexture();
  // The 5 m terrain is drawn as chunks whose detail drops with distance from the camera (see terrainLod.js).
  const terrainMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: 0xaaa79e,
    map: regolith,
    normalMap: regolithNormal,
    normalScale: new THREE.Vector2(REGOLITH_NORMAL_SCALE, REGOLITH_NORMAL_SCALE),
    roughness: 0.96,
    metalness: 0,
  });
  const terrain = createTerrainLod(site.terrain, { albedo: site.albedo ?? null, material: terrainMaterial });
  const terrainMesh = terrain.group;
  scene.add(terrainMesh);

  const eyeY = heightAt(site.terrain, 0, 0) + 2;
  scene.add(buildHorizonRing(site.horizon, eyeY));
  scene.add(buildStars());
  // Faint fill light: in the shade the ground still catches a little light from the sunlit terrain around it,
  // so the shadows are dark but not a featureless black. The shadow-lift aid raises it to SHADOW_LIFT_INTENSITY.
  const ambient = new THREE.AmbientLight(0x1b1814, AMBIENT_INTENSITY);
  const ambientBase = ambient.intensity;
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize[0], shadowMapSize[1]);
  const corners = terrainBoxCorners(site.terrain);
  const frustum = shadowFrustumHalfSize(site.terrain);
  const farthest = Math.max(...corners.map((p) => p.length()));
  lightDistance = Math.max(SUN_LIGHT_DISTANCE_M, frustum + 500, farthest + 500);
  sun.shadow.normalBias = 0.5;
  scene.add(sun, sun.target);

  /** Fit the shadow camera to the terrain for a Sun in `direction` (unit vector towards it). */
  function fitShadow(direction) {
    const fit = fitShadowCamera(corners, direction, lightDistance);
    Object.assign(sun.shadow.camera, fit);
    sun.shadow.camera.updateProjectionMatrix();
    // bias and normal bias follow the size of one shadow texel (the coarser axis), so finer maps do not detach shadows
    const texel = Math.max((fit.right - fit.left) / sun.shadow.mapSize.x, (fit.top - fit.bottom) / sun.shadow.mapSize.y);
    sun.shadow.normalBias = Math.max(0.1, texel * 0.28);
    sun.shadow.bias = -(texel * 2.5) / (fit.far - fit.near);
  }
  fitShadow(new THREE.Vector3(1, 0.03, 0).normalize());

  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(BODY_DISTANCE_M * Math.tan(SUN_RADIUS_DEG * RAD), 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff4d6 }),
  );
  sunDisc.name = 'sun-disc';
  scene.add(sunDisc);

  // halo around the Sun: additive, hidden behind the terrain like the disc itself
  const sunGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createGlowTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.55,
    }),
  );
  sunGlow.name = 'sun-glow';
  sunGlow.scale.setScalar(2 * BODY_DISTANCE_M * Math.tan(GLOW_RADIUS_DEG * RAD));
  scene.add(sunGlow);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(BODY_DISTANCE_M * Math.tan(EARTH_RADIUS_DEG * RAD), 48, 32),
    // stylised oceans, continents and clouds (see earthTexture.js); the Sun's light gives the phase
    new THREE.MeshStandardMaterial({ map: createEarthTexture(), roughness: 1, metalness: 0 }),
  );
  earth.name = 'earth';
  // clouds: a transparent shell a hair above the surface, lit by the same Sun
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(BODY_DISTANCE_M * Math.tan(EARTH_RADIUS_DEG * RAD) * 1.012, 48, 32),
    new THREE.MeshStandardMaterial({ map: createCloudTexture(), transparent: true, depthWrite: false, roughness: 1, metalness: 0 }),
  );
  clouds.name = 'earth-clouds';
  clouds.castShadow = false;
  clouds.receiveShadow = false;
  earth.add(clouds);
  earth.castShadow = false;
  earth.receiveShadow = false;
  scene.add(earth);

  /** Swap the Earth's surface texture (NASA's image once it has loaded); the previous one is freed. */
  function setEarthMap(texture) {
    earth.material.map?.dispose();
    earth.material.map = texture;
    earth.material.needsUpdate = true;
  }

  /** Move the Sun and Earth; `timeMs` (optional) turns the Earth so the right continents face the Moon. */
  function updateSky(sky, timeMs = null) {
    const s = directionFromAzEl(sky.sun.azDeg, sky.sun.elDeg);
    sun.position.set(s.x, s.y, s.z).multiplyScalar(lightDistance);
    fitShadow(new THREE.Vector3(s.x, s.y, s.z));
    sunDisc.position.set(s.x, s.y, s.z).multiplyScalar(BODY_DISTANCE_M);
    sunGlow.position.copy(sunDisc.position);
    const e = directionFromAzEl(sky.earth.azDeg, sky.earth.elDeg);
    earth.position.set(e.x, e.y, e.z).multiplyScalar(BODY_DISTANCE_M);
    if (timeMs !== null) earth.rotation.y = earthYaw(e, subLunarLongitudeDeg(timeMs));
  }

  /** Free the GPU resources of this world (call when switching to another site). */
  function dispose() {
    scene.traverse((object) => {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        material?.map?.dispose();
        material?.normalMap?.dispose();
        material?.dispose();
      }
    });
    terrain.dispose();
    sun.shadow.map?.dispose();
  }

  /**
   * Choose the level of detail of each terrain chunk for a camera at `position`.
   * @returns {boolean} whether any chunk changed, so the shadow map needs redrawing
   */
  function updateLod(position, budget) {
    return terrain.update(position, budget);
  }

  /** Show (true) or hide the LROC tone variation on the terrain; no effect on a site without a tone map. */
  function setLrocTexture(on) {
    terrain.setAlbedoStrength(on ? ALBEDO_STRENGTH : 0);
  }

  /** Visual aid only: lighten the shadows without touching any calculation. */
  function setShadowLift(on) {
    ambient.intensity = on ? SHADOW_LIFT_INTENSITY : ambientBase;
  }

  return { scene, sun, sunDisc, sunGlow, earth, terrainMesh, ambient, terrain, updateLod, updateSky, setEarthMap, setLrocTexture, setShadowLift, eyeY, dispose };
}
