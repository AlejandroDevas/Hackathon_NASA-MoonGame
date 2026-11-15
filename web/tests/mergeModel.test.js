import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { mergeByMaterial } from '../src/scene/mergeModel.js';

const red = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const blue = new THREE.MeshStandardMaterial({ color: 0x0000ff });

function box(material, x, y, z, size = 1) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function trianglesOf(root) {
  let n = 0;
  root.traverse((o) => {
    if (o.isMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  });
  return n;
}

describe('mergeByMaterial', () => {
  test('one mesh per material, with the same triangles and the same overall box', () => {
    const root = new THREE.Group();
    root.add(box(red, 0, 0, 0), box(red, 5, 0, 0), box(red, 0, 5, 0), box(blue, -4, 0, 0), box(blue, 0, 0, 7));
    const trisBefore = trianglesOf(root);
    const boxBefore = new THREE.Box3().setFromObject(root);
    const counts = mergeByMaterial(root);
    expect(counts).toEqual({ before: 5, after: 2 });
    expect(root.children).toHaveLength(2);
    expect(trianglesOf(root)).toBe(trisBefore);
    const boxAfter = new THREE.Box3().setFromObject(root);
    expect(boxAfter.min.toArray()).toEqual(boxBefore.min.toArray());
    expect(boxAfter.max.toArray()).toEqual(boxBefore.max.toArray());
    expect(new Set(root.children.map((m) => m.material))).toEqual(new Set([red, blue]));
  });

  test('bakes nested transforms in the space of the root', () => {
    const root = new THREE.Group();
    const arm = new THREE.Group();
    arm.position.set(10, 0, 0);
    arm.rotation.y = Math.PI / 2;
    arm.scale.setScalar(2);
    const a = box(red, 1, 0, 0);
    const b = box(red, 0, 3, 0);
    arm.add(a, b);
    root.add(arm);
    const boxBefore = new THREE.Box3().setFromObject(root);
    mergeByMaterial(root);
    const merged = root.children.find((c) => c.isMesh);
    expect(merged).toBeDefined();
    merged.geometry.computeBoundingBox();
    const boxAfter = new THREE.Box3().setFromObject(root);
    for (let i = 0; i < 3; i++) {
      expect(boxAfter.min.getComponent(i)).toBeCloseTo(boxBefore.min.getComponent(i), 4);
      expect(boxAfter.max.getComponent(i)).toBeCloseTo(boxBefore.max.getComponent(i), 4);
    }
  });

  test('the root keeps its own transform: positions stay in the root space', () => {
    const root = new THREE.Group();
    root.position.set(100, 20, -30);
    root.scale.setScalar(3);
    root.add(box(red, 1, 0, 0), box(red, -1, 0, 0));
    const boxBefore = new THREE.Box3().setFromObject(root);
    mergeByMaterial(root);
    expect(root.position.toArray()).toEqual([100, 20, -30]);
    const boxAfter = new THREE.Box3().setFromObject(root);
    expect(boxAfter.min.toArray()).toEqual(boxBefore.min.toArray());
    expect(boxAfter.max.toArray()).toEqual(boxBefore.max.toArray());
  });

  test('a material used by one mesh, hidden meshes, multi-material meshes and instanced meshes are left alone', () => {
    const root = new THREE.Group();
    const lone = box(blue, 0, 0, 0);
    const hidden = box(red, 2, 0, 0);
    hidden.visible = false;
    const multi = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [red, blue]);
    const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), red, 3);
    root.add(lone, hidden, multi, instanced, box(red, 4, 0, 0));
    expect(mergeByMaterial(root)).toEqual({ before: 5, after: 5 });
    expect(root.children).toContain(lone);
    expect(root.children).toContain(hidden);
    expect(root.children).toContain(multi);
    expect(root.children).toContain(instanced);
  });

  test('skinned meshes are not merged', () => {
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const skinned = new THREE.SkinnedMesh(geometry, red);
    root.add(skinned, box(red, 1, 0, 0), box(red, 2, 0, 0));
    const counts = mergeByMaterial(root);
    expect(counts).toEqual({ before: 3, after: 2 });
    expect(root.children).toContain(skinned);
  });

  test('keeps shadow flags, and merges meshes with different attribute sets using the common ones', () => {
    const root = new THREE.Group();
    const a = box(red, 0, 0, 0);
    const b = box(red, 3, 0, 0);
    b.geometry.deleteAttribute('uv');
    a.castShadow = true;
    a.receiveShadow = true;
    root.add(a, b);
    mergeByMaterial(root);
    const merged = root.children[0];
    expect(merged.castShadow).toBe(true);
    expect(merged.receiveShadow).toBe(true);
    expect(merged.geometry.attributes.position.count).toBe(48);
    expect(merged.geometry.attributes.uv).toBeUndefined();
    expect(merged.geometry.attributes.normal).toBeDefined();
  });

  test('merges indexed and non-indexed geometries together', () => {
    const root = new THREE.Group();
    const indexed = box(red, 0, 0, 0);
    const plain = box(red, 3, 0, 0);
    plain.geometry = plain.geometry.toNonIndexed();
    root.add(indexed, plain);
    const trisBefore = trianglesOf(root);
    mergeByMaterial(root);
    expect(root.children).toHaveLength(1);
    expect(trianglesOf(root)).toBe(trisBefore);
  });

  test('frees the geometries of the meshes it replaced', () => {
    const root = new THREE.Group();
    const a = box(red, 0, 0, 0);
    const b = box(red, 3, 0, 0);
    let disposed = 0;
    a.geometry.addEventListener('dispose', () => disposed++);
    b.geometry.addEventListener('dispose', () => disposed++);
    root.add(a, b);
    mergeByMaterial(root);
    expect(disposed).toBe(2);
  });

  test('a model with nothing to merge is unchanged', () => {
    const root = new THREE.Group();
    root.add(box(red, 0, 0, 0), box(blue, 1, 0, 0));
    expect(mergeByMaterial(root)).toEqual({ before: 2, after: 2 });
    expect(root.children).toHaveLength(2);
  });
});
