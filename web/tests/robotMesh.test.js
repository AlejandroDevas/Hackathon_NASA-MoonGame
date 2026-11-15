import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createRobotMesh, loadNasaRover } from '../src/scene/robotMesh.js';

// The real loader needs a browser (fetch + decoding); a fake one returns a model we control.
let loadAsync;
let dracoLoader;
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    setDRACOLoader(loader) {
      dracoLoader = loader;
    }
    loadAsync(url) {
      return loadAsync(url);
    }
  },
}));

/** A 4 x 1 x 2 m box placed away from the origin, standing in for the NASA model. */
function fakeModel() {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 2), new THREE.MeshStandardMaterial({ roughness: 0.1 }));
  mesh.position.set(10, 5, -3);
  const scene = new THREE.Group();
  scene.add(mesh);
  return { scene, mesh };
}

function attachedRobot() {
  const robot = createRobotMesh();
  new THREE.Scene().add(robot);
  return robot;
}

beforeEach(() => {
  loadAsync = vi.fn();
  dracoLoader = null;
});
afterEach(() => vi.restoreAllMocks());

describe('loadNasaRover', () => {
  test('scales the model to 2.8 m, stands it on the ground and replaces the simple rover', async () => {
    const { scene } = fakeModel();
    loadAsync.mockResolvedValue({ scene });
    const robot = attachedRobot();

    const model = await loadNasaRover(robot, '/models/rover.glb');

    expect(loadAsync).toHaveBeenCalledWith('/models/rover.glb');
    expect(model).toBe(scene);
    expect(model.name).toBe('nasa-perseverance-rover');
    expect(robot.children).toEqual([model]);
    robot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(robot);
    const size = box.getSize(new THREE.Vector3());
    expect(Math.max(size.x, size.z)).toBeCloseTo(2.8, 3);
    expect(box.min.y).toBeCloseTo(0, 3); // wheels on the ground
    const centre = box.getCenter(new THREE.Vector3());
    expect(centre.x).toBeCloseTo(0, 3);
    expect(centre.z).toBeCloseTo(0, 3);
  });

  test('every mesh casts and receives shadows and is not too glossy', async () => {
    const { scene, mesh } = fakeModel();
    loadAsync.mockResolvedValue({ scene });
    await loadNasaRover(attachedRobot(), '/models/rover.glb');
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
    expect(mesh.material.roughness).toBeGreaterThanOrEqual(0.6);
  });

  test('keeps the simple rover (and warns) when the model cannot be loaded', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    loadAsync.mockRejectedValue(new Error('404'));
    const robot = attachedRobot();
    const before = [...robot.children];

    expect(await loadNasaRover(robot, '/models/missing.glb')).toBeNull();

    expect(robot.children).toEqual(before);
    expect(robot.children.filter((c) => c.name === 'wheel')).toHaveLength(6);
    expect(warn).toHaveBeenCalled();
  });

  test('a rover removed from the scene while loading is not touched and the model is freed', async () => {
    const { scene, mesh } = fakeModel();
    loadAsync.mockResolvedValue({ scene });
    const dispose = vi.spyOn(mesh.geometry, 'dispose');
    const robot = createRobotMesh(); // never added to a scene: robot.parent is null

    expect(await loadNasaRover(robot, '/models/rover.glb')).toBeNull();

    expect(robot.children.length).toBeGreaterThan(1); // still the simple rover
    expect(dispose).toHaveBeenCalled();
  });

  test('hands the glTF loader a Draco decoder (the NASA file is Draco-compressed) from a local path', async () => {
    const { scene } = fakeModel();
    loadAsync.mockResolvedValue({ scene });
    await loadNasaRover(attachedRobot(), '/models/rover.glb', '/draco/');
    expect(dracoLoader).not.toBeNull();
    expect(dracoLoader.decoderPaths.js).toBe('/draco/draco_wasm_wrapper.js');
    expect(dracoLoader.decoderPaths.wasm).toBe('/draco/draco_decoder.wasm');
  });
});
