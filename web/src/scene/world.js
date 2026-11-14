import * as THREE from 'three';
import { directionFromAzEl } from './sky.js';
import { heightAt } from './terrainData.js';
import { buildTerrainGeometry } from './terrainMesh.js';

const RAD = Math.PI / 180;
const SUN_LIGHT_DISTANCE_M = 6_000; // keeps the shadow frustum tight around the 5 km terrain
const BODY_DISTANCE_M = 50_000;
const STAR_DISTANCE_M = 90_000;
const RING_RADIUS_M = 6_000;
const SUN_RADIUS_DEG = 0.2666;
const EARTH_RADIUS_DEG = 0.95;
const STAR_COUNT = 1500;

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
  for (let i = 0; i < STAR_COUNT; i++) {
    const y = random() * 2 - 1;
    const phi = random() * Math.PI * 2;
    const ring = Math.sqrt(1 - y * y);
    positions.set([ring * Math.cos(phi) * STAR_DISTANCE_M, y * STAR_DISTANCE_M, ring * Math.sin(phi) * STAR_DISTANCE_M], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false }),
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
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const terrainMesh = new THREE.Mesh(
    buildTerrainGeometry(site.terrain, 2),
    new THREE.MeshStandardMaterial({ color: 0x8c8a86, roughness: 1, metalness: 0 }),
  );
  terrainMesh.name = 'terrain';
  terrainMesh.castShadow = true;
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  const eyeY = heightAt(site.terrain, 0, 0) + 2;
  scene.add(buildHorizonRing(site.horizon, eyeY));
  scene.add(buildStars());
  scene.add(new THREE.AmbientLight(0x101216, 1));

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const frustum = 2_600;
  Object.assign(sun.shadow.camera, { left: -frustum, right: frustum, top: frustum, bottom: -frustum, near: 100, far: 12_000 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.5;
  scene.add(sun, sun.target);

  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(BODY_DISTANCE_M * Math.tan(SUN_RADIUS_DEG * RAD), 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff4d6 }),
  );
  sunDisc.name = 'sun-disc';
  scene.add(sunDisc);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(BODY_DISTANCE_M * Math.tan(EARTH_RADIUS_DEG * RAD), 32, 32),
    new THREE.MeshStandardMaterial({ color: 0x3a6fb0, roughness: 1, metalness: 0 }),
  );
  earth.name = 'earth';
  earth.castShadow = false;
  earth.receiveShadow = false;
  scene.add(earth);

  function updateSky(sky) {
    const s = directionFromAzEl(sky.sun.azDeg, sky.sun.elDeg);
    sun.position.set(s.x, s.y, s.z).multiplyScalar(SUN_LIGHT_DISTANCE_M);
    sunDisc.position.set(s.x, s.y, s.z).multiplyScalar(BODY_DISTANCE_M);
    const e = directionFromAzEl(sky.earth.azDeg, sky.earth.elDeg);
    earth.position.set(e.x, e.y, e.z).multiplyScalar(BODY_DISTANCE_M);
  }

  return { scene, sun, sunDisc, earth, terrainMesh, updateSky, eyeY };
}
