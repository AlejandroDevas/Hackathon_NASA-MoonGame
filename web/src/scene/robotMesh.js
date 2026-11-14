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

  const panel = add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 1.1), new THREE.MeshStandardMaterial({ color: 0x1c3a6b, roughness: 0.4 })));
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
