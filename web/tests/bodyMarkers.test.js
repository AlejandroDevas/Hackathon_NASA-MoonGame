import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { setLocale } from '../src/i18n.js';
import { avoidRects, createBodyMarkers, edgeMarker } from '../src/scene/bodyMarkers.js';

afterEach(() => setLocale('es'));

const AREA = { left: 20, top: 80, right: 780, bottom: 520 }; // an 800 x 600 screen with the bars taken off
const CENTRE = { x: 400, y: 300 };
const FOV_SCALE = 500;

describe('edgeMarker', () => {
  test('a body inside the free area needs no marker', () => {
    expect(edgeMarker({ x: 1, y: 0.5, z: -10 }, AREA, FOV_SCALE, CENTRE)).toBeNull();
  });

  test('a body in front of the camera but off to the right is marked at the right edge, pointing right', () => {
    const marker = edgeMarker({ x: 20, y: 0, z: -10 }, AREA, FOV_SCALE, CENTRE);
    expect(marker.x).toBeCloseTo(AREA.right, 3);
    expect(marker.y).toBeCloseTo(300, 3);
    expect(marker.angleDeg).toBeCloseTo(0, 3);
  });

  test('above the picture it is marked at the top edge, pointing up', () => {
    const marker = edgeMarker({ x: 0, y: 30, z: -10 }, AREA, FOV_SCALE, CENTRE);
    expect(marker.y).toBeCloseTo(AREA.top, 3);
    expect(marker.angleDeg).toBeCloseTo(-90, 3);
  });

  test('a body behind the camera is marked on the side it lies towards', () => {
    const marker = edgeMarker({ x: -5, y: 0, z: 40 }, AREA, FOV_SCALE, CENTRE);
    expect(marker.x).toBeCloseTo(AREA.left, 3);
    expect(marker.angleDeg).toBeCloseTo(180, 3);
  });

  test('a body straight behind points down, and every marker stays inside the area', () => {
    expect(edgeMarker({ x: 0, y: 0, z: 50 }, AREA, FOV_SCALE, CENTRE).angleDeg).toBeCloseTo(90, 3);
    for (const view of [{ x: 3, y: -4, z: 9 }, { x: -50, y: 20, z: -2 }, { x: 0.1, y: 40, z: -1 }]) {
      const m = edgeMarker(view, AREA, FOV_SCALE, CENTRE);
      expect(m.x).toBeGreaterThanOrEqual(AREA.left - 1e-6);
      expect(m.x).toBeLessThanOrEqual(AREA.right + 1e-6);
      expect(m.y).toBeGreaterThanOrEqual(AREA.top - 1e-6);
      expect(m.y).toBeLessThanOrEqual(AREA.bottom + 1e-6);
    }
  });

  test('a body in front but hidden under a bar (outside the free area) is marked at the edge', () => {
    // projects to y = 300 - 0.55 * 500 = 25 px: on screen, but under the top bar
    const marker = edgeMarker({ x: 0, y: 5.5, z: -10 }, AREA, FOV_SCALE, CENTRE);
    expect(marker.y).toBeCloseTo(AREA.top, 3);
  });
});

describe('avoidRects', () => {
  const minimap = { left: 650, top: 60, right: 780, bottom: 190 };

  test('a marker that does not touch a panel stays where it is', () => {
    expect(avoidRects({ x: 400, y: 80 }, 30, 11, [minimap], AREA)).toEqual({ x: 400, y: 80 });
  });

  test('on the top edge it slides sideways, to the side of the panel it was nearer to', () => {
    const spot = avoidRects({ x: 700, y: 80 }, 30, 11, [minimap], AREA);
    expect(spot.y).toBe(80);
    expect(spot.x + 30).toBeLessThan(minimap.left); // clear of it, to its left
  });

  test('on the right edge it slides down below the panel', () => {
    const spot = avoidRects({ x: 780, y: 120 }, 30, 11, [minimap], AREA);
    expect(spot.x).toBe(780);
    expect(spot.y - 11).toBeGreaterThan(minimap.bottom);
  });

  test('never leaves the free area', () => {
    const wide = { left: 0, top: 0, right: 800, bottom: 600 };
    const spot = avoidRects({ x: 400, y: 80 }, 30, 11, [wide], AREA);
    expect(spot.x).toBeGreaterThanOrEqual(AREA.left);
    expect(spot.x).toBeLessThanOrEqual(AREA.right);
  });
});

describe('createBodyMarkers', () => {
  let hud;
  beforeEach(() => {
    hud = document.createElement('div');
  });

  const camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.5, 150000); // looks down -z from the origin
  camera.updateMatrixWorld(true);
  const positions = { sun: new THREE.Vector3(60000, 0, -1000), earth: new THREE.Vector3(0, 0, -50000) };

  test('marks only the bodies that are above the horizon and out of the picture; the labels follow the language', () => {
    const markers = createBodyMarkers(hud);
    markers.setVisible({ sun: true, earth: true });
    markers.update(camera, 800, 600, positions);
    const sun = hud.querySelector('.scene-body-sun');
    const earth = hud.querySelector('.scene-body-earth');
    expect(sun.hidden).toBe(false); // far to the right of a 60 degree view
    expect(earth.hidden).toBe(true); // dead ahead: it is in the picture
    expect(sun.textContent).toBe('Sol');
    setLocale('en');
    markers.setVisible({ sun: true, earth: true });
    expect(sun.textContent).toBe('Sun');
  });

  test('a body below the horizon gets no marker', () => {
    const markers = createBodyMarkers(hud);
    markers.setVisible({ sun: false, earth: false });
    markers.update(camera, 800, 600, positions);
    expect(hud.querySelector('.scene-body-sun').hidden).toBe(true);
  });

  test('the layer is hidden from assistive technology (the sky readout already says where the bodies are)', () => {
    expect(createBodyMarkers(hud).el.getAttribute('aria-hidden')).toBe('true');
  });
});
