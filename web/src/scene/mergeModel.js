import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Attributes present in every geometry of the list (merging needs the same set everywhere). */
function commonAttributes(geometries) {
  const [first, ...rest] = geometries;
  return Object.keys(first.attributes).filter((name) => rest.every((g) => g.attributes[name]));
}

/**
 * Merge the plain meshes of a loaded model that share a material into one mesh per material.
 * The NASA models are hundreds of small meshes (252 for the rover, 157 for the lunar module), and
 * each one is a draw call, twice per frame with shadows. A merged mesh draws exactly the same
 * triangles in one call. Skinned, instanced, morphing, hidden or multi-material meshes are left alone,
 * and so is a material used by a single mesh. The model's own transform is unchanged; every merged
 * vertex is expressed in the root's space.
 * @param {THREE.Object3D} root the loaded scene
 * @returns {{before: number, after: number}} mesh counts, for logging and tests
 */
export function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  let before = 0;
  root.traverse((object) => {
    if (!object.isMesh) return;
    before++;
    if (object.isSkinnedMesh || object.isInstancedMesh || !object.visible) return;
    if (Array.isArray(object.material) || object.morphTargetInfluences?.length) return;
    if (!groups.has(object.material)) groups.set(object.material, []);
    groups.get(object.material).push(object);
  });

  let removed = 0;
  let added = 0;
  for (const [material, meshes] of groups) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map((mesh) => {
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld));
      return geometry;
    });
    // keep only the attributes all of them have, and make them all indexed or all not
    const keep = commonAttributes(geometries);
    const indexed = geometries.every((g) => g.index);
    const prepared = geometries.map((geometry) => {
      for (const name of Object.keys(geometry.attributes)) if (!keep.includes(name)) geometry.deleteAttribute(name);
      geometry.morphAttributes = {};
      return indexed || !geometry.index ? geometry : geometry.toNonIndexed();
    });
    const merged = mergeGeometries(prepared, false);
    for (const geometry of geometries) geometry.dispose();
    if (!merged) continue;

    const mesh = new THREE.Mesh(merged, material);
    mesh.name = meshes[0].name ? `${meshes[0].name}-merged` : 'merged';
    mesh.castShadow = meshes[0].castShadow;
    mesh.receiveShadow = meshes[0].receiveShadow;
    for (const original of meshes) {
      original.removeFromParent();
      original.geometry.dispose();
    }
    root.add(mesh);
    removed += meshes.length;
    added++;
  }
  return { before, after: before - removed + added };
}
