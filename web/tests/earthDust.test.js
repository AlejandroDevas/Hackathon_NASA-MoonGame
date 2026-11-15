import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { DustSim, MOON_G, createDust } from '../src/scene/dust.js';
import { EARTH_HEIGHT, EARTH_WIDTH, createEarthTexture, earthPixels, flipRows } from '../src/scene/earthTexture.js';
import { earthYaw, moonPhaseFraction, subLunarLongitudeDeg, subsolarLongitudeDeg } from '../src/scene/earthView.js';
import { directionFromAzEl } from '../src/scene/sky.js';

describe('earth texture', () => {
  const pixels = earthPixels();
  const at = (lon, lat) => {
    const x = Math.round(((lon + 180) / 360) * (EARTH_WIDTH - 1));
    const y = Math.round(((90 - lat) / 180) * (EARTH_HEIGHT - 1));
    const i = (y * EARTH_WIDTH + x) * 4;
    return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
  };

  test('is deterministic and fully opaque', () => {
    expect(Array.from(earthPixels(64, 32))).toEqual(Array.from(earthPixels(64, 32)));
    expect(pixels).toHaveLength(EARTH_WIDTH * EARTH_HEIGHT * 4);
    for (let i = 3; i < pixels.length; i += 4) expect(pixels[i]).toBe(255);
  });

  test('reads as a blue planet overall (blue is the strongest channel on average)', () => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      r += pixels[i];
      g += pixels[i + 1];
      b += pixels[i + 2];
    }
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g * 1.02);
  });

  test('oceans are blue, the poles white, and land is not blue', () => {
    // mid Pacific, mid Atlantic and the Indian Ocean: dominated by blue even with some cloud
    let blueOceans = 0;
    for (const [lon, lat] of [[-150, 0], [-30, -20], [80, -25], [-140, -30]]) {
      const [r, g, b] = at(lon, lat);
      if (b > r) blueOceans++;
    }
    expect(blueOceans).toBeGreaterThanOrEqual(3);
    expect(at(0, -88).every((c) => c > 150)).toBe(true); // Antarctica
    expect(at(10, 88).every((c) => c > 150)).toBe(true); // Arctic ice
  });

  test('continents are where they should roughly be: land is greener or browner than the sea', () => {
    const isLandish = ([r, g, b]) => b < r + 30 && g + r > b; // not the deep-blue ocean signature
    // central Africa, Amazon, central Siberia, Australia's interior, Canada
    let land = 0;
    for (const [lon, lat] of [[22, 2], [-62, -5], [95, 60], [134, -25], [-100, 58]]) if (isLandish(at(lon, lat))) land++;
    expect(land).toBeGreaterThanOrEqual(4);
    // the middle of the Pacific is not
    expect(isLandish(at(-150, 0))).toBe(false);
  });

  test('the Sahara is drier-coloured than the Congo basin', () => {
    const [sr, , sb] = at(15, 24);
    const [cr, , cb] = at(22, 0);
    expect(sr - sb).toBeGreaterThan(cr - cb); // redder, less green-blue
  });
});

describe('earth texture on the sphere', () => {
  test('the first row of the uploaded texture is the south pole (v = 0), so the planet is not upside down', () => {
    const north = earthPixels(16, 8);
    const flipped = flipRows(north, 16, 8);
    // earthPixels starts at the north pole: its first row is Arctic ice, its last row Antarctica; flipped, the reverse
    expect(Array.from(flipped.subarray(0, 16 * 4))).toEqual(Array.from(north.subarray(7 * 16 * 4, 8 * 16 * 4)));
    expect(Array.from(flipped.subarray(7 * 16 * 4))).toEqual(Array.from(north.subarray(0, 16 * 4)));
    const texture = createEarthTexture();
    expect(texture.image.width).toBe(EARTH_WIDTH);
    expect(texture.image.height).toBe(EARTH_HEIGHT);
    const firstRowIsSouth = texture.image.data[0] > 150 && texture.image.data[1] > 150 && texture.image.data[2] > 150; // white Antarctica
    expect(firstRowIsSouth).toBe(true);
    texture.dispose();
  });
});

describe('earth view', () => {
  test('moon phase is 0 at the reference new Moon and ~0.5 half a month later', () => {
    const newMoon = Date.UTC(2000, 0, 6, 18, 14);
    expect(moonPhaseFraction(newMoon)).toBeCloseTo(0, 6);
    expect(moonPhaseFraction(newMoon + 14.765294 * 86_400_000)).toBeCloseTo(0.5, 4);
    const k = moonPhaseFraction(Date.UTC(2027, 0, 1));
    expect(k).toBeGreaterThanOrEqual(0);
    expect(k).toBeLessThan(1);
  });

  test('the Sun is overhead at Greenwich at 12:00 UTC and 90 degrees west at 18:00', () => {
    expect(subsolarLongitudeDeg(Date.UTC(2027, 5, 1, 12))).toBeCloseTo(0, 6);
    expect(subsolarLongitudeDeg(Date.UTC(2027, 5, 1, 18))).toBeCloseTo(-90, 6);
    expect(subsolarLongitudeDeg(Date.UTC(2027, 5, 1, 0))).toBeCloseTo(180, 6);
  });

  test('at new Moon the sub-lunar point is the sub-solar point (a full Earth seen from the Moon)', () => {
    const t = Date.UTC(2000, 0, 6, 18, 14);
    expect(subLunarLongitudeDeg(t)).toBeCloseTo(subsolarLongitudeDeg(t) - 360 * Math.floor((subsolarLongitudeDeg(t) + 180) / 360), 3);
  });

  test('at first quarter the Moon is 90 degrees east of the sub-solar point', () => {
    const t = Date.UTC(2000, 0, 6, 18, 14) + (29.530588 / 4) * 86_400_000;
    const expected = ((((subsolarLongitudeDeg(t) + 90 + 180) % 360) + 360) % 360) - 180;
    expect(subLunarLongitudeDeg(t)).toBeCloseTo(expected, 3);
  });

  test('always in [-180, 180)', () => {
    for (let i = 0; i < 200; i++) {
      const lon = subLunarLongitudeDeg(Date.UTC(2026, 0, 1) + i * 7_300_000);
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThan(180);
    }
  });

  test('earthYaw turns the chosen meridian to face the observer, whatever the Earth direction', () => {
    for (const [az, el] of [[0, 3], [90, 5], [180, 6], [270, -2], [145, 6.7]]) {
      const e = directionFromAzEl(az, el);
      for (const lon of [-120, 0, 33, 170]) {
        const yaw = earthYaw(e, lon);
        // the unrotated sphere shows longitude `lon` towards (cos lon, 0, -sin lon)
        const facing = new THREE.Vector3(Math.cos((lon * Math.PI) / 180), 0, -Math.sin((lon * Math.PI) / 180))
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
          .normalize();
        const towardsObserver = new THREE.Vector3(-e.x, 0, -e.z).normalize();
        expect(facing.distanceTo(towardsObserver)).toBeLessThan(1e-9);
      }
    }
  });

  test('the sphere UVs agree with that convention (longitude 0 on +X, east towards -Z)', () => {
    const g = new THREE.SphereGeometry(1, 64, 32);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    // find the equatorial vertex whose u is closest to 0.5 (longitude 0) and to 0.75 (longitude 90 east)
    const find = (target) => {
      let best = null;
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getY(i)) > 1e-6 + 0.001) continue;
        const d = Math.abs(uv.getX(i) - target);
        if (!best || d < best.d) best = { d, i };
      }
      return new THREE.Vector3().fromBufferAttribute(pos, best.i);
    };
    const lon0 = find(0.5);
    const lon90 = find(0.75);
    expect(lon0.x).toBeGreaterThan(0.99);
    expect(lon90.z).toBeLessThan(-0.99);
  });
});

describe('DustSim', () => {
  const flat = () => 0;

  test('a grain flies a parabola under lunar gravity, with no drag', () => {
    const sim = new DustSim(4);
    sim.emit(0, 0.5, 0, 2, 3, 0, 0.05);
    const dt = 0.001;
    let t = 0;
    let peak = 0.5;
    while (sim.state[0] === 1 && t < 10) {
      sim.step(dt, flat);
      t += dt;
      peak = Math.max(peak, sim.pos[1]);
    }
    expect(peak).toBeCloseTo(0.5 + (3 * 3) / (2 * MOON_G), 1); // v²/2g above the start
    // horizontal speed is unchanged (no air): x = vx * t
    expect(sim.pos[0]).toBeCloseTo(2 * t, 1);
    expect(sim.state[0]).toBe(2); // landed
  });

  test('it takes about 6 times longer to fall than on Earth: a 1 m/s hop lasts ~1.2 s', () => {
    const sim = new DustSim(1);
    sim.emit(0, 0.025, 0, 0, 1, 0, 0.05);
    let t = 0;
    while (sim.state[0] === 1 && t < 10) {
      sim.step(0.002, flat);
      t += 0.002;
    }
    expect(t).toBeGreaterThan(1.1);
    expect(t).toBeLessThan(1.35);
  });

  test('a landed grain rests, then frees its slot', () => {
    const sim = new DustSim(2);
    sim.emit(0, 0.1, 0, 0, 0, 0, 0.05);
    for (let i = 0; i < 400 && sim.state[0] === 1; i++) sim.step(0.01, flat);
    expect(sim.state[0]).toBe(2);
    expect(sim.vel[0]).toBe(0);
    expect(sim.count()).toBe(1);
    for (let i = 0; i < 100; i++) sim.step(0.01, flat);
    expect(sim.state[0]).toBe(0);
    expect(sim.count()).toBe(0);
  });

  test('grains follow uneven ground and die when they leave the map', () => {
    const sim = new DustSim(2);
    const slope = (x) => (x > 5 ? NaN : x * 0.2);
    sim.emit(0, 3, 0, 3, 0, 0, 0.05);
    for (let i = 0; i < 2000 && sim.state[0] !== 0; i++) sim.step(0.01, slope);
    expect(sim.state[0]).toBe(0);
  });

  test('recycles the oldest slot when the pool is full', () => {
    const sim = new DustSim(3);
    for (let i = 0; i < 5; i++) sim.emit(i, 1, 0, 0, 0, 0, 0.05);
    expect(sim.count()).toBe(3);
    expect(sim.pos[0]).toBe(3); // slot 0 now holds the 4th grain
    expect(sim.pos[3]).toBe(4);
  });
});

describe('createDust (rover)', () => {
  const robot = { x: 0, z: 0, y: 10, headingDeg: 0 };
  const rng = () => 0.5;

  test('a rover driving north throws grains behind it, on both sides, up and back', () => {
    const dust = createDust(100);
    dust.emitFromWheels(robot, 1, 0, -1, 4, rng); // north is -z
    const { sim } = dust;
    expect(sim.count()).toBe(18);
    const xs = [];
    for (let i = 0; i < sim.capacity; i++) {
      if (sim.state[i] === 0) continue;
      expect(sim.pos[i * 3 + 2]).toBeGreaterThan(0.9); // behind the rover (south = +z)
      expect(sim.vel[i * 3 + 1]).toBeGreaterThan(0.5); // up
      expect(sim.vel[i * 3 + 2]).toBeGreaterThan(0); // thrown backwards
      xs.push(Math.sign(sim.pos[i * 3]));
    }
    expect(xs).toContain(-1);
    expect(xs).toContain(1);
  });

  test('no dust when stopped or crawling, and a cap per frame', () => {
    const dust = createDust(100);
    dust.emitFromWheels(robot, 0, 0, -1, 0, rng);
    dust.emitFromWheels(robot, 0.01, 0, -1, 0.3, rng);
    expect(dust.sim.count()).toBe(0);
    dust.emitFromWheels(robot, 50, 0, -1, 12, rng);
    expect(dust.sim.count()).toBeLessThanOrEqual(18);
  });

  test('update advances the grains and keeps the instanced mesh in step with them', () => {
    const dust = createDust(50);
    dust.emitFromWheels(robot, 1, 0, -1, 4, rng);
    const matrix = new THREE.Matrix4();
    dust.mesh.getMatrixAt(0, matrix);
    expect(matrix.elements[0]).toBe(0); // not synced yet: scale 0
    dust.update(0.05, () => 0);
    dust.mesh.getMatrixAt(0, matrix);
    expect(matrix.elements[0]).toBeGreaterThan(0); // alive grain now has size
    expect(dust.mesh.isInstancedMesh).toBe(true);
    expect(dust.mesh.castShadow).toBe(false);
  });
});
