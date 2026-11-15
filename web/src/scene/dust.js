import * as THREE from 'three';

/** Lunar surface gravity, m/s². */
export const MOON_G = 1.62;
/** Seconds a grain stays on the ground (shrinking) after landing, before it is recycled. */
const SETTLE_S = 0.6;

/**
 * Ballistic dust: grains kicked up by the wheels follow parabolas under lunar gravity with
 * NO air drag, so they fly high and slow, never billow, and fall back where they were thrown.
 * Plain arrays, no three.js, so it can be tested on its own. Slots are recycled oldest-first.
 */
export class DustSim {
  constructor(capacity = 420) {
    this.capacity = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    /** 0 = free, 1 = flying, 2 = resting on the ground */
    this.state = new Uint8Array(capacity);
    this.rest = new Float32Array(capacity);
    this.next = 0;
  }

  /** Start a grain at (x, y, z) with velocity (vx, vy, vz) m/s; `size` is its radius in metres. */
  emit(x, y, z, vx, vy, vz, size) {
    const i = this.next;
    this.next = (this.next + 1) % this.capacity;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.size[i] = size;
    this.state[i] = 1;
    this.rest[i] = 0;
  }

  /**
   * Advance every grain by `dt` seconds. `groundAt(x, z)` gives the terrain height; a grain
   * that reaches it (or leaves the map) lands, stays a moment and then disappears.
   */
  step(dt, groundAt) {
    for (let i = 0; i < this.capacity; i++) {
      const s = this.state[i];
      if (s === 0) continue;
      if (s === 2) {
        this.rest[i] -= dt;
        if (this.rest[i] <= 0) this.state[i] = 0;
        continue;
      }
      const k = i * 3;
      this.vel[k + 1] -= MOON_G * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      const ground = groundAt(this.pos[k], this.pos[k + 2]);
      if (!Number.isFinite(ground)) {
        this.state[i] = 0; // flew off the mapped terrain
      } else if (this.pos[k + 1] <= ground + this.size[i] * 0.5) {
        this.pos[k + 1] = ground + this.size[i] * 0.5;
        this.vel.fill(0, k, k + 3);
        this.state[i] = 2;
        this.rest[i] = SETTLE_S;
      }
    }
  }

  /** Number of grains flying or resting. */
  count() {
    let n = 0;
    for (let i = 0; i < this.capacity; i++) if (this.state[i] !== 0) n++;
    return n;
  }
}

const dummy = new THREE.Object3D();

/**
 * The dust the rover throws up, drawn as small lit spheres (one InstancedMesh), so the
 * grains catch the low Sun like the rocks do.
 */
export function createDust(capacity = 420) {
  const sim = new DustSim(capacity);
  const mesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0xb2ada1, roughness: 1, metalness: 0, flatShading: true }),
    capacity,
  );
  mesh.name = 'dust';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false; // the instances move; the bounding sphere is not kept in sync

  function sync() {
    for (let i = 0; i < capacity; i++) {
      const state = sim.state[i];
      if (state === 0) {
        dummy.scale.setScalar(0);
      } else {
        const fade = state === 2 ? Math.max(sim.rest[i], 0) / SETTLE_S : 1;
        dummy.scale.setScalar(sim.size[i] * fade);
        dummy.position.set(sim.pos[i * 3], sim.pos[i * 3 + 1], sim.pos[i * 3 + 2]);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  sync();

  let carry = 0;

  return {
    mesh,
    sim,
    /**
     * Throw dust from the rear wheels of a rover that just moved `moved` metres.
     * @param {{x: number, z: number, y: number, headingDeg: number}} robot
     * @param {number} moved metres travelled this frame (always >= 0)
     * @param {number} dirX unit vector of the travel direction (x)
     * @param {number} dirZ unit vector of the travel direction (z)
     * @param {number} speed m/s
     * @param {() => number} [random]
     */
    emitFromWheels(robot, moved, dirX, dirZ, speed, random = Math.random) {
      if (moved <= 0 || speed < 0.6) return;
      carry += moved * 18; // ~18 grains per metre driven
      const count = Math.min(Math.floor(carry), 18);
      carry -= Math.floor(carry);
      const rightX = dirZ * -1; // perpendicular to the travel direction, in the ground plane
      const rightZ = dirX;
      for (let n = 0; n < count; n++) {
        const side = n % 2 === 0 ? -1 : 1;
        const behind = 1.1 + random() * 0.4;
        const x = robot.x - dirX * behind + rightX * side * 0.85;
        const z = robot.z - dirZ * behind + rightZ * side * 0.85;
        const back = 0.35 + random() * Math.min(1.4, speed * 0.28);
        const lateral = (random() - 0.5) * 0.9;
        const up = 0.7 + random() * 1.5;
        sim.emit(
          x,
          robot.y + 0.15,
          z,
          -dirX * back + rightX * lateral,
          up,
          -dirZ * back + rightZ * lateral,
          0.06 + random() * 0.14,
        );
      }
    },
    update(dt, groundAt) {
      sim.step(dt, groundAt);
      sync();
    },
  };
}
