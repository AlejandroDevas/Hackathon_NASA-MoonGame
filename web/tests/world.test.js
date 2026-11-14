import { describe, expect, test, vi } from 'vitest';
import { directionFromAzEl } from '../src/scene/sky.js';
import { gridToScene } from '../src/scene/terrainData.js';
import { buildTerrainGeometry } from '../src/scene/terrainMesh.js';
import { createWorld, horizonRingProfile, shadowFrustumHalfSize } from '../src/scene/world.js';
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
    expect(world.sun.shadow.mapSize.x).toBe(4096);
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
    const geometry = vi.spyOn(world.terrainMesh.geometry, 'dispose');
    const material = vi.spyOn(world.terrainMesh.material, 'dispose');
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

  test('createWorld uses it for the shadow camera', () => {
    const world = createWorld(loadTinySite());
    const camera = world.sun.shadow.camera;
    expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([-500, 500, 500, -500]);
  });
});
