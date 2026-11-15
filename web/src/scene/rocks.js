import * as THREE from 'three';
import { gridToScene, heightAt, slopeDegAt } from './terrainData.js';

const MAX_ROCK_SLOPE_DEG = 28;
const VARIANTS = 3;

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

/**
 * Where the boulders go: a scatter over the whole map plus denser patches around the
 * given centres (the landing zone, the robot's start). Rocks avoid steep ground and the
 * edge of the map. Deterministic for a given seed; positions come from the real height map.
 * @param {import('./terrainData.js').Terrain} terrain
 * @param {{seed?: number, scatter?: number, patches?: Array<{x: number, z: number, radiusM: number, count: number}>, keepClear?: Array<{x: number, z: number, radiusM: number}>}} options
 * @returns {Array<{x: number, y: number, z: number, scale: number, yaw: number, variant: number, tone: number}>}
 */
export function placeRocks(terrain, { seed = 4242, scatter = 1600, patches = [], keepClear = [] } = {}) {
  const random = mulberry32(seed);
  const rocks = [];
  const ok = (x, z) => {
    if (!Number.isFinite(heightAt(terrain, x, z))) return false;
    if (slopeDegAt(terrain, x, z) > MAX_ROCK_SLOPE_DEG) return false;
    return keepClear.every((k) => Math.hypot(x - k.x, z - k.z) > k.radiusM);
  };
  const add = (x, z) => {
    // mostly small stones, a few large boulders (exponential size distribution, in metres)
    const scale = Math.min(0.22 + -Math.log(1 - random() * 0.999) * 0.42, 4.2);
    rocks.push({
      x,
      y: heightAt(terrain, x, z) - scale * 0.18, // sunk a little into the regolith
      z,
      scale,
      yaw: random() * Math.PI * 2,
      variant: Math.floor(random() * VARIANTS),
      tone: 0.72 + random() * 0.38,
    });
  };

  let placed = 0;
  for (let attempt = 0; placed < scatter && attempt < scatter * 6; attempt++) {
    const margin = 12;
    const r = margin + random() * (terrain.rows - 1 - 2 * margin);
    const c = margin + random() * (terrain.cols - 1 - 2 * margin);
    const { x, z } = gridToScene(terrain, r, c);
    if (!ok(x, z)) continue;
    add(x, z);
    placed++;
  }
  for (const patch of patches) {
    let n = 0;
    for (let attempt = 0; n < patch.count && attempt < patch.count * 8; attempt++) {
      const angle = random() * Math.PI * 2;
      const distance = patch.radiusM * Math.sqrt(random());
      const x = patch.x + Math.cos(angle) * distance;
      const z = patch.z + Math.sin(angle) * distance;
      if (!ok(x, z)) continue;
      add(x, z);
      n++;
    }
  }
  return rocks;
}

const hash3 = (x, y, z) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return n - Math.floor(n);
};

/** A lumpy, slightly flattened boulder: an icosphere whose vertices are pushed in and out. */
function rockGeometry(variant) {
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const position = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    // same displacement for every copy of a shared corner, so faces stay joined
    const bump = 0.72 + 0.5 * hash3(Math.round(v.x * 50) + variant * 17, Math.round(v.y * 50), Math.round(v.z * 50));
    v.multiplyScalar(bump);
    v.y *= 0.62 + variant * 0.08;
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** One InstancedMesh per rock shape, so thousands of stones cost three draw calls. */
export function buildRocks(placements) {
  const group = new THREE.Group();
  group.name = 'rocks';
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let variant = 0; variant < VARIANTS; variant++) {
    const mine = placements.filter((p) => p.variant === variant);
    if (!mine.length) continue;
    const mesh = new THREE.InstancedMesh(
      rockGeometry(variant),
      new THREE.MeshStandardMaterial({ color: 0x8d8a82, roughness: 1, metalness: 0, flatShading: true }),
      mine.length,
    );
    mine.forEach((rock, i) => {
      dummy.position.set(rock.x, rock.y, rock.z);
      dummy.rotation.set(0, rock.yaw, 0);
      dummy.scale.setScalar(rock.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.setScalar(rock.tone));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `rocks-${variant}`;
    group.add(mesh);
  }
  return group;
}
