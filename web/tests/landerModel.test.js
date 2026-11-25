// @vitest-environment node
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { APOLLO_MODULE_WIDTH_M, loadApolloModule } from '../src/scene/lander.js';

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

/** A 20 x 14 x 12 unit box away from the origin, standing in for the NASA model. */
function fakeModel() {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(20, 14, 12), new THREE.MeshStandardMaterial());
  mesh.position.set(30, 50, -8);
  const scene = new THREE.Group();
  scene.add(mesh);
  return { scene, mesh };
}

beforeEach(() => {
  loadAsync = vi.fn();
  dracoLoader = null;
});
afterEach(() => vi.restoreAllMocks());

describe('loadApolloModule', () => {
  test('scales the model to its real width, centres it and stands it on y = 0', async () => {
    const { scene } = fakeModel();
    loadAsync.mockResolvedValue({ scene });
    const model = await loadApolloModule('/models/lm.glb', '/draco/');
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    expect(Math.max(size.x, size.z)).toBeCloseTo(APOLLO_MODULE_WIDTH_M, 4);
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(centre.x).toBeCloseTo(0, 4);
    expect(centre.z).toBeCloseTo(0, 4);
    expect(model.name).toBe('nasa-apollo-lunar-module');
  });

  test('every mesh casts and receives shadows', async () => {
    const { scene, mesh } = fakeModel();
    loadAsync.mockResolvedValue({ scene });
    await loadApolloModule('/models/lm.glb', '/draco/');
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
  });

  test('uses the local Draco decoder the NASA file needs', async () => {
    loadAsync.mockResolvedValue({ scene: fakeModel().scene });
    await loadApolloModule('/models/lm.glb', '/draco/');
    expect(dracoLoader.decoderPaths.wasm).toBe('/draco/draco_decoder.wasm');
  });

  test('resolves to null (and warns) when the file cannot be loaded, so the simple lander stays', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    loadAsync.mockRejectedValue(new Error('404'));
    expect(await loadApolloModule('/models/missing.glb', '/draco/')).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});
