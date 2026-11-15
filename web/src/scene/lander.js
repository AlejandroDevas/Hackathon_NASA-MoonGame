import * as THREE from 'three';
import { heightAt } from './terrainData.js';

const FOOT_RADIUS_M = 3.4;
const FOOT_ANGLES = [45, 135, 225, 315];
const UP = new THREE.Vector3(0, 1, 0);

/** A cylinder of `radius` running from point `a` to point `b`. */
function limb(a, b, radius, material, segments = 8) {
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = direction.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material);
  mesh.position.copy(a).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
  return mesh;
}

/**
 * Heights (m above the lowest foot) of the four footpads of a lander standing at (x, z).
 * @returns {{base: number, feet: Array<{x: number, z: number, dy: number}>}}
 */
export function footingAt(terrain, x, z) {
  const feet = FOOT_ANGLES.map((deg) => {
    const a = (deg * Math.PI) / 180;
    const fx = x + Math.cos(a) * FOOT_RADIUS_M;
    const fz = z + Math.sin(a) * FOOT_RADIUS_M;
    const h = heightAt(terrain, fx, fz);
    return { x: fx - x, z: fz - z, h: Number.isFinite(h) ? h : heightAt(terrain, x, z) };
  });
  const base = Math.min(...feet.map((f) => f.h));
  return { base, feet: feet.map((f) => ({ x: f.x, z: f.z, dy: f.h - base })) };
}

/**
 * A stylised lunar lander (a four-legged descent stage under a crew-sized upper deck, dish
 * antenna and two solar wings). It is an original procedural model, not a NASA vehicle:
 * its job is to mark where the mission lands. Legs are cut to reach the terrain under each
 * footpad, so it stands on uneven ground. The origin is the lowest footpad's ground level.
 * @param {Array<{x: number, z: number, dy: number}>} feet
 */
export function buildLander(feet) {
  const lander = new THREE.Group();
  lander.name = 'lander';

  const foil = new THREE.MeshStandardMaterial({ color: 0xc8a24a, metalness: 0.85, roughness: 0.38 });
  const hull = new THREE.MeshStandardMaterial({ color: 0xd9d6cc, metalness: 0.4, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c2c30, metalness: 0.3, roughness: 0.7 });
  const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x1b2230, metalness: 0.6, roughness: 0.35 });

  const highest = Math.max(...feet.map((f) => f.dy));
  const bodyBottom = highest + 1.5;

  const stage = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 1.7, 8), foil);
  stage.position.y = bodyBottom + 0.85;
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 1.5, 8), hull);
  deck.position.y = bodyBottom + 2.45;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.7, 0.5, 8), foil);
  roof.position.y = bodyBottom + 3.45;
  const engine = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.1, 16, 1, true), dark);
  engine.rotation.x = Math.PI;
  engine.position.y = bodyBottom - 0.45;
  engine.material.side = THREE.DoubleSide;
  lander.add(stage, deck, roof, engine);

  for (const foot of feet) {
    const joint = new THREE.Vector3(foot.x * 0.62, bodyBottom + 0.55, foot.z * 0.62);
    const pad = new THREE.Vector3(foot.x, foot.dy + 0.12, foot.z);
    lander.add(limb(joint, pad, 0.11, hull));
    // a short brace from the middle of the hull to the middle of the leg
    const brace = new THREE.Vector3(foot.x * 0.3, bodyBottom + 1.5, foot.z * 0.3);
    const mid = new THREE.Vector3().lerpVectors(joint, pad, 0.55);
    lander.add(limb(brace, mid, 0.06, hull, 6));
    const footpad = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.14, 16), dark);
    footpad.position.set(foot.x, foot.dy + 0.07, foot.z);
    lander.add(footpad);
  }

  // dish antenna on a mast, and two solar wings on the deck
  const mast = limb(new THREE.Vector3(0.9, bodyBottom + 3.6, 0), new THREE.Vector3(1.2, bodyBottom + 4.7, 0.3), 0.05, hull, 6);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.8, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3), hull);
  dish.material = hull.clone();
  dish.material.side = THREE.DoubleSide;
  dish.position.set(1.2, bodyBottom + 4.85, 0.3);
  dish.rotation.set(-0.5, 0, 0.35);
  lander.add(mast, dish);
  for (const side of [-1, 1]) {
    const arm = limb(new THREE.Vector3(side * 1.7, bodyBottom + 2.5, 0), new THREE.Vector3(side * 2.6, bodyBottom + 2.5, 0), 0.05, hull, 6);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.06, 1.6), panelMaterial);
    panel.position.set(side * 4.0, bodyBottom + 2.5, 0);
    panel.rotation.z = side * -0.12;
    lander.add(arm, panel);
  }

  lander.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return lander;
}

/** Width (m) the NASA module is scaled to: the real Apollo Lunar Module measured about 9.4 m across its footpads. */
export const APOLLO_MODULE_WIDTH_M = 9.4;

function disposeObject(root) {
  root.traverse?.((object) => {
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material ?? {})) if (value?.isTexture) value.dispose();
      material?.dispose();
    }
  });
}

export { disposeObject };

/**
 * Load NASA's Apollo Lunar Module (Draco-compressed GLB) and stand it on the ground: scaled
 * to its real width, centred, with its lowest point at y = 0. Resolves to the model, or to
 * null (with a console warning) when it cannot be loaded, so the caller keeps the simple one.
 * @param {string} url
 * @param {string} [decoderPath] folder with the local Draco decoder
 */
export async function loadApolloModule(url, decoderPath = `${import.meta.env.BASE_URL}draco/`) {
  let draco = null;
  try {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
    const loader = new GLTFLoader();
    draco = new DRACOLoader();
    draco.setDecoderPath(decoderPath);
    loader.setDRACOLoader(draco);
    const gltf = await loader.loadAsync(url);
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    model.scale.setScalar(APOLLO_MODULE_WIDTH_M / Math.max(size.x, size.z));
    model.position.set(0, 0, 0);
    model.updateMatrixWorld(true);
    const placed = new THREE.Box3().setFromObject(model);
    const centre = placed.getCenter(new THREE.Vector3());
    model.position.set(-centre.x, -placed.min.y, -centre.z);
    model.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    const wrapper = new THREE.Group();
    wrapper.name = 'nasa-apollo-lunar-module';
    wrapper.add(model);
    return wrapper;
  } catch (error) {
    console.warn('NASA lunar module model could not be loaded; keeping the simple lander.', error);
    return null;
  } finally {
    draco?.dispose();
  }
}
