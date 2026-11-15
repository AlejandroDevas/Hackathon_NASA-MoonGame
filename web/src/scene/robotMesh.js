import * as THREE from 'three';

/**
 * A small six-wheeled rover built from primitives (about 1.8 m long). The origin is
 * on the ground and the front faces -z (north when the heading is 0).
 */
export function createRobotMesh() {
  const robot = new THREE.Group();
  robot.name = 'robot';
  const add = (mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    robot.add(mesh);
    return mesh;
  };

  const body = add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 1.8), new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.7 })));
  body.position.y = 0.75;

  const panel = add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 1.1), new THREE.MeshStandardMaterial({ color: 0x51452e, roughness: 0.55 })));
  panel.position.set(0, 1.08, 0.1);
  panel.rotation.x = -0.12;

  const mast = add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0x9a9da3 })));
  mast.position.set(0, 1.35, -0.7);
  const head = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xe8e8e8 })));
  head.position.set(0, 1.85, -0.7);

  const wheelGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16);
  wheelGeometry.rotateZ(Math.PI / 2); // axle along x
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 1 });
  for (const x of [-0.75, 0.75]) {
    for (const z of [-0.7, 0, 0.7]) {
      const wheel = add(new THREE.Mesh(wheelGeometry, wheelMaterial));
      wheel.name = 'wheel';
      wheel.position.set(x, 0.35, z);
    }
  }
  return robot;
}

/**
 * Load NASA's detailed rover model into the existing steerable wrapper. The GLB is
 * Draco-compressed, so the (local) Draco decoder in `decoderPath` is needed to open it.
 */
export async function loadNasaRover(robot, url, decoderPath = `${import.meta.env.BASE_URL}draco/`) {
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
    if (!robot.parent) {
      disposeModel(model);
      return null;
    }
    model.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const targetLength = 2.8;
    model.scale.setScalar(targetLength / Math.max(size.x, size.z));
    model.rotation.y = Math.PI;
    // Centre it AFTER scaling and turning: rotating about the origin after centring would
    // push a model that is not centred on its own origin away from the rover's position.
    model.position.set(0, 0, 0);
    model.updateMatrixWorld(true);
    const placed = new THREE.Box3().setFromObject(model);
    const centre = placed.getCenter(new THREE.Vector3());
    model.position.set(-centre.x, -placed.min.y, -centre.z);
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.roughness = Math.max(material.roughness ?? 0.65, 0.6);
      }
    });

    // Retain the simple model until the NASA asset has loaded successfully.
    for (const child of [...robot.children]) {
      robot.remove(child);
      disposeModel(child);
    }
    model.name = 'nasa-perseverance-rover';
    robot.add(model);
    return model;
  } catch (error) {
    console.warn('NASA rover model could not be loaded; keeping the simplified rover.', error);
    return null;
  } finally {
    draco?.dispose();
  }
}

function disposeModel(root) {
  root.traverse?.((object) => {
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material ?? {})) {
        if (value?.isTexture) value.dispose();
      }
      material?.dispose();
    }
  });
}
