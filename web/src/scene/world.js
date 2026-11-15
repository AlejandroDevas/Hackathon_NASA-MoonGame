import * as THREE from 'three';
import { directionFromAzEl } from './sky.js';
import { gridToScene, heightAt } from './terrainData.js';
import { earthYaw, subLunarLongitudeDeg } from './earthView.js';
import { createEarthTexture } from './earthTexture.js';
import { createGlowTexture } from './glow.js';
import { createRegolithTexture } from './regolith.js';
import { buildTerrainGeometry } from './terrainMesh.js';

const RAD = Math.PI / 180;
const SUN_LIGHT_DISTANCE_M = 6_000; // keeps the shadow frustum tight around the 5 km terrain
const BODY_DISTANCE_M = 50_000;
const STAR_DISTANCE_M = 90_000;
const RING_RADIUS_M = 6_000;
const SUN_RADIUS_DEG = 0.2666;
const EARTH_RADIUS_DEG = 0.95;
const STAR_COUNT = 4500;
const GLOW_RADIUS_DEG = 5;
/** The shadow-lift aid multiplies the (almost black) ambient light by this much; a visual aid only. */
const SHADOW_LIFT_FACTOR = 40;

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
export function createWorld(site) {
  let lightDistance = SUN_LIGHT_DISTANCE_M;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Procedural regolith grain (not imagery): colour variation plus a bump map that the grazing sunlight picks out.
  const regolith = createRegolithTexture();
  const terrainMesh = new THREE.Mesh(
    // Use every 5 m LOLA sample rather than thinning the scene to 10 m.
    buildTerrainGeometry(site.terrain, 1),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      color: 0xaaa79e,
      map: regolith,
      bumpMap: regolith,
      bumpScale: 2.2,
      roughness: 0.96,
      metalness: 0,
    }),
  );
  terrainMesh.name = 'terrain';
  terrainMesh.castShadow = true;
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  const eyeY = heightAt(site.terrain, 0, 0) + 2;
  scene.add(buildHorizonRing(site.horizon, eyeY));
  scene.add(buildStars());
  const ambient = new THREE.AmbientLight(0x161411, 1);
  const ambientBase = ambient.intensity;
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const frustum = shadowFrustumHalfSize(site.terrain);
  lightDistance = Math.max(SUN_LIGHT_DISTANCE_M, frustum + 500);
  Object.assign(sun.shadow.camera, {
    left: -frustum,
    right: frustum,
    top: frustum,
    bottom: -frustum,
    near: 100,
    far: lightDistance + frustum + 500,
  });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.5;
  scene.add(sun, sun.target);

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
  earth.castShadow = false;
  earth.receiveShadow = false;
  scene.add(earth);

  /** Move the Sun and Earth; `timeMs` (optional) turns the Earth so the right continents face the Moon. */
  function updateSky(sky, timeMs = null) {
    const s = directionFromAzEl(sky.sun.azDeg, sky.sun.elDeg);
    sun.position.set(s.x, s.y, s.z).multiplyScalar(lightDistance);
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
        material?.dispose();
      }
    });
    sun.shadow.map?.dispose();
  }

  /** Visual aid only: lighten the shadows without touching any calculation. */
  function setShadowLift(on) {
    ambient.intensity = on ? ambientBase * SHADOW_LIFT_FACTOR : ambientBase;
  }

  return { scene, sun, sunDisc, sunGlow, earth, terrainMesh, ambient, updateSky, setShadowLift, eyeY, dispose };
}
