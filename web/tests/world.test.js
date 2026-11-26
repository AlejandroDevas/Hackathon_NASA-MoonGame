// @vitest-environment node
import * as THREE from 'three';
import { describe, expect, test, vi } from 'vitest';
import { directionFromAzEl } from '../src/scene/sky.js';
import { gridToScene } from '../src/scene/terrainData.js';
import { buildTerrainGeometry, terrainColor } from '../src/scene/terrainMesh.js';
import {
  DEFAULT_SHADOW_MAP_SIZE,
  SMALL_SHADOW_MAP_SIZE,
  createWorld,
  fitShadowCamera,
  horizonRingProfile,
  shadowFrustumHalfSize,
} from '../src/scene/world.js';
import { loadTinySite, loadTinyTerrain, makeTerrain } from './helpers.js';

const tiny = loadTinyTerrain();

describe('buildTerrainGeometry', () => {
  test('one vertex per grid cell at its scene position and height', () => {
    const g = buildTerrainGeometry(tiny, 1);
    expect(g.attributes.position.count).toBe(101 * 101);
    for (const [r, c] of [[0, 0], [50, 50], [90, 20], [100, 100]]) {
      const i = r * 101 + c;
      const { x, z } = gridToScene(tiny, r, c);
      expect(g.attributes.position.getX(i)).toBeCloseTo(x, 4);
      expect(g.attributes.position.getY(i)).toBeCloseTo(tiny.heights[i], 4);
      expect(g.attributes.position.getZ(i)).toBeCloseTo(z, 4);
    }
  });

  test('rotates with north_bearing_deg', () => {
    const t = makeTerrain({ rows: 11, cols: 11, observerRc: [5, 5], northBearingDeg: 90, height: () => 0 });
    const g = buildTerrainGeometry(t, 1);
    const { x, z } = gridToScene(t, 0, 5); // grid "up" is true west when the bearing is 90
    expect(x).toBeCloseTo(-25, 6);
    expect(g.attributes.position.getX(5)).toBeCloseTo(-25, 4);
    expect(g.attributes.position.getZ(5)).toBeCloseTo(z, 4);
  });

  test('two triangles per cell and a stride that thins the grid', () => {
    expect(buildTerrainGeometry(tiny, 1).index.count).toBe(100 * 100 * 6);
    expect(buildTerrainGeometry(tiny, 2).attributes.position.count).toBe(51 * 51);
  });

  test('faces point up (winding): normals of flat terrain have y = +1', () => {
    const flat = makeTerrain({ rows: 9, cols: 9, observerRc: [4, 4], northBearingDeg: 222.5, height: () => 100 });
    const normals = buildTerrainGeometry(flat, 1).attributes.normal;
    for (let i = 0; i < normals.count; i++) expect(normals.getY(i)).toBeCloseTo(1, 5);
  });
});

describe('horizonRingProfile', () => {
  test('radius times the tangent of the elevation', () => {
    const horizon = new Float32Array(360);
    horizon[10] = 45;
    horizon[20] = -10;
    const profile = horizonRingProfile(horizon, 1000);
    expect(profile).toHaveLength(360);
    expect(profile[0]).toBe(0);
    expect(profile[10]).toBeCloseTo(1000, 2);
    expect(profile[20]).toBeLessThan(0);
  });
});

describe('createWorld', () => {
  const world = createWorld(loadTinySite());
  world.updateSky({ sun: { azDeg: 90, elDeg: 10 }, earth: { azDeg: 180, elDeg: 5 } });
  const direction = (v) => {
    const n = v.clone().normalize();
    return { x: n.x, y: n.y, z: n.z };
  };

  test('light, sun disc and Earth sit in the direction of their azimuth/elevation', () => {
    const sun = directionFromAzEl(90, 10);
    const earth = directionFromAzEl(180, 5);
    for (const v of [direction(world.sun.position), direction(world.sunDisc.position)]) {
      expect(v.x).toBeCloseTo(sun.x, 6);
      expect(v.y).toBeCloseTo(sun.y, 6);
      expect(v.z).toBeCloseTo(sun.z, 6);
    }
    const e = direction(world.earth.position);
    expect([e.x, e.y, e.z]).toEqual([expect.closeTo(earth.x, 6), expect.closeTo(earth.y, 6), expect.closeTo(earth.z, 6)]);
  });

  test('the sun casts shadows, the Earth does not', () => {
    expect(world.sun.castShadow).toBe(true);
    expect(world.earth.castShadow).toBe(false);
    // wide and short: fitted to the terrain as seen from the nearly horizontal Sun, same texel count as 4096 x 4096
    const { x, y } = world.sun.shadow.mapSize;
    expect([x, y]).toEqual(DEFAULT_SHADOW_MAP_SIZE);
    expect(x * y).toBe(4096 * 4096);
  });

  test('a smaller shadow map can be asked for (GPUs that cannot make 8192-wide textures)', () => {
    const small = createWorld(loadTinySite(), { shadowMapSize: SMALL_SHADOW_MAP_SIZE });
    expect(small.sun.shadow.mapSize.toArray()).toEqual(SMALL_SHADOW_MAP_SIZE);
  });

  test('has the terrain, the horizon ring and stars in the scene', () => {
    const names = world.scene.children.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['terrain', 'horizon-ring', 'stars']));
    expect(world.eyeY).toBeCloseTo(tiny.heights[50 * 101 + 50] + 2, 3);
  });
});

describe('world.dispose', () => {
  test('frees the geometries and materials so switching sites does not leak GPU memory', () => {
    const world = createWorld(loadTinySite());
    const chunk = world.terrain.chunks[0];
    const geometry = vi.spyOn(chunk.geometries[3], 'dispose');
    const material = vi.spyOn(chunk.mesh.material, 'dispose');
    world.dispose();
    expect(geometry).toHaveBeenCalled();
    expect(material).toHaveBeenCalled();
  });
});

describe('shadowFrustumHalfSize', () => {
  test('covers the corners of the terrain, plus 100 m, rounded up to 100 m', () => {
    expect(shadowFrustumHalfSize(tiny)).toBe(500); // corners at ~353.6 m
  });

  test('a rotated terrain (bearing 222.5) is covered out to its corners, not just half its side', () => {
    const t = makeTerrain({ rows: 1001, cols: 1001, observerRc: [500, 500], northBearingDeg: 222.5, height: () => 0 });
    expect(shadowFrustumHalfSize(t)).toBe(3700); // corners at ~3535.5 m
  });

  test('an off-centre observer is covered out to the far corner', () => {
    const t = makeTerrain({ rows: 1001, cols: 1001, observerRc: [100, 100], height: () => 0 });
    expect(shadowFrustumHalfSize(t)).toBeGreaterThanOrEqual(Math.hypot(4500, 4500));
  });

});

describe('fitShadowCamera', () => {
  const corners = [];
  for (const x of [-2500, 2500]) for (const y of [700, 1100]) for (const z of [-2500, 2500]) corners.push(new THREE.Vector3(x, y, z));
  const LIGHT_DISTANCE = 6000;

  /** The corners as an orthographic camera with the fitted bounds would see them (NDC). */
  function ndcOf(direction) {
    const fit = fitShadowCamera(corners, direction, LIGHT_DISTANCE);
    const camera = new THREE.OrthographicCamera(fit.left, fit.right, fit.top, fit.bottom, fit.near, fit.far);
    camera.position.copy(direction).normalize().multiplyScalar(LIGHT_DISTANCE);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    return { fit, points: corners.map((c) => c.clone().project(camera)) };
  }

  test.each([
    ['a Sun on the horizon from the east', [1, 0.02, 0]],
    ['a low Sun from the north-west', [-0.68, 0.03, -0.73]],
    ['a higher Sun', [0.3, 0.5, 0.2]],
  ])('every corner of the terrain is inside the frustum for %s', (_name, v) => {
    const { points } = ndcOf(new THREE.Vector3(...v));
    for (const p of points) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(1);
    }
  });

  test('with the Sun on the horizon the frustum is a wide, shallow rectangle, not a square', () => {
    const { fit } = ndcOf(new THREE.Vector3(1, 0.02, 0));
    expect(fit.right - fit.left).toBeGreaterThan(4 * (fit.top - fit.bottom));
  });

  test('createWorld fits the shadow camera to the terrain and refits it when the Sun moves', () => {
    const world = createWorld(loadTinySite());
    const camera = world.sun.shadow.camera;
    world.updateSky({ sun: { azDeg: 90, elDeg: 1 }, earth: { azDeg: 180, elDeg: 5 } });
    const low = camera.top - camera.bottom;
    world.updateSky({ sun: { azDeg: 90, elDeg: 40 }, earth: { azDeg: 180, elDeg: 5 } });
    expect(camera.top - camera.bottom).toBeGreaterThan(low); // a higher Sun sees a taller strip of ground
    expect(camera.near).toBeGreaterThanOrEqual(1);
    expect(camera.far).toBeGreaterThan(camera.near);
  });
});

describe('terrainColor', () => {
  test('is brighter higher up (same cell, so the grain cancels)', () => {
    expect(terrainColor(100, 0, 100, 5, 5)).toBeGreaterThan(terrainColor(0, 0, 100, 5, 5));
  });

  test('is deterministic', () => {
    expect(terrainColor(40, 0, 100, 12, 33)).toBe(terrainColor(40, 0, 100, 12, 33));
  });

  test('stays between 0.5 and 1 even for absurd heights', () => {
    for (const h of [-1e6, -5, 0, 50, 100, 1e6]) {
      const g = terrainColor(h, 0, 100, 7, 9);
      expect(g).toBeGreaterThanOrEqual(0.5);
      expect(g).toBeLessThanOrEqual(1);
    }
  });

  test('flat terrain (min === max) is not NaN', () => {
    expect(Number.isFinite(terrainColor(10, 10, 10, 1, 1))).toBe(true);
  });

  test('the terrain geometry carries one colour per vertex in [0, 1]', () => {
    const g = buildTerrainGeometry(tiny, 2);
    const colors = g.attributes.color;
    expect(colors.itemSize).toBe(3);
    expect(colors.count).toBe(g.attributes.position.count);
    for (let i = 0; i < colors.array.length; i++) {
      expect(colors.array[i]).toBeGreaterThanOrEqual(0);
      expect(colors.array[i]).toBeLessThanOrEqual(1);
    }
  });
});

describe('world look and shadow lift', () => {
  const world = createWorld(loadTinySite());

  test('4500 stars with varying brightness', () => {
    const stars = world.scene.children.find((c) => c.name === 'stars');
    expect(stars.geometry.attributes.position.count).toBe(4500);
    const colors = stars.geometry.attributes.color;
    expect(colors.count).toBe(4500);
    const values = new Set(Array.from(colors.array.slice(0, 300)).map((v) => v.toFixed(3)));
    expect(values.size).toBeGreaterThan(20);
  });

  test('setShadowLift brightens the ambient light and turning it off restores it exactly', () => {
    const base = world.ambient.intensity;
    world.setShadowLift(true);
    expect(world.ambient.intensity).toBeGreaterThan(base);
    world.setShadowLift(false);
    expect(world.ambient.intensity).toBe(base);
  });
});

describe('the Earth in the sky', () => {
  test('is blue overall (the real colour of the planet, not a grey ball that reads as another Moon)', () => {
    const earth = createWorld(loadTinySite()).earth;
    expect(earth.material.map).not.toBeNull();
    const { data } = earth.material.map.image;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  test('turns with the time so the sub-lunar longitude faces the observer', () => {
    const world = createWorld(loadTinySite());
    const sky = { sun: { azDeg: 90, elDeg: 10 }, earth: { azDeg: 180, elDeg: 5 } };
    world.updateSky(sky); // no time: keeps its rotation
    expect(world.earth.rotation.y).toBe(0);
    world.updateSky(sky, Date.UTC(2027, 0, 1, 12));
    const a = world.earth.rotation.y;
    world.updateSky(sky, Date.UTC(2027, 0, 1, 18));
    expect(world.earth.rotation.y).not.toBeCloseTo(a, 3);
  });
});
