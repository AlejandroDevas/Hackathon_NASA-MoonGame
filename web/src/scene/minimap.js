import { t } from '../i18n.js';
import { contains, heightAt } from './terrainData.js';

/** Pixels of the map (square). It is drawn at this size and scaled by CSS, so it stays sharp on dense screens. */
export const MAP_SIZE_PX = 160;
const RAD = Math.PI / 180;
/** Light from the north-west and well above, so relief reads like a printed map. */
const LIGHT = (() => {
  const v = [-1, 1.3, -1];
  const n = Math.hypot(...v);
  return v.map((c) => c / n);
})();
const BASE_RGB = [178, 172, 157];

/** Half the side of the area the map covers, in metres (scene axes), for a terrain. */
export function mapHalfExtentM(terrain) {
  return 0.5 * Math.max(terrain.rows, terrain.cols) * terrain.pixelM;
}

/** Pixel of the map for a scene point: x (east) goes right and z (south) goes down, so north is up. */
export function sceneToMap(x, z, halfExtentM, size = MAP_SIZE_PX) {
  return { px: ((x + halfExtentM) / (2 * halfExtentM)) * size, py: ((z + halfExtentM) / (2 * halfExtentM)) * size };
}

/**
 * The terrain as a shaded-relief picture (RGBA, `size` x `size`): light from the north-west, a little
 * darker the lower the ground, and transparent outside the mapped area.
 * @returns {Uint8ClampedArray}
 */
export function renderTerrainTile(terrain, size = MAP_SIZE_PX, halfExtentM = mapHalfExtentM(terrain)) {
  const out = new Uint8ClampedArray(size * size * 4);
  const metresPerPixel = (2 * halfExtentM) / size;
  const d = Math.max(metresPerPixel, terrain.pixelM); // sample the slope over about one map pixel
  const span = Math.max(terrain.maxM - terrain.minM, 1e-6);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = ((i + 0.5) / size) * 2 * halfExtentM - halfExtentM;
      const z = ((j + 0.5) / size) * 2 * halfExtentM - halfExtentM;
      if (!contains(terrain, x, z)) continue; // stays transparent
      const h = heightAt(terrain, x, z);
      const dhdx = (heightAt(terrain, x + d, z) - heightAt(terrain, x - d, z)) / (2 * d);
      const dhdz = (heightAt(terrain, x, z + d) - heightAt(terrain, x, z - d)) / (2 * d);
      if (!Number.isFinite(h) || !Number.isFinite(dhdx) || !Number.isFinite(dhdz)) continue;
      const norm = Math.hypot(dhdx, 1, dhdz);
      const lit = Math.max(0, (-dhdx * LIGHT[0] + LIGHT[1] - dhdz * LIGHT[2]) / norm);
      const height01 = Math.min(1, Math.max(0, (h - terrain.minM) / span));
      const k = (0.22 + 0.78 * lit) * (0.72 + 0.28 * height01);
      const o = (j * size + i) * 4;
      out[o] = BASE_RGB[0] * k;
      out[o + 1] = BASE_RGB[1] * k;
      out[o + 2] = BASE_RGB[2] * k;
      out[o + 3] = 255;
    }
  }
  return out;
}

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/**
 * A small map of the whole site in the corner of the 3D view: the terrain in relief, the lander
 * (where the rover is headed), the highest and lowest points, a dashed line to the lander, and the rover
 * with the way it faces. North is up. Without a canvas (or before a terrain is set) it draws nothing.
 * @returns {{el: HTMLElement, setTerrain(terrain: object, pois?: Array<{id: string, x: number, z: number}>): void,
 *   update(robot: {x: number, z: number, headingDeg: number}): void, setHidden(hidden: boolean): void, refreshTexts(): void}}
 */
export function createMinimap() {
  const root = el('div', 'scene-minimap');
  root.setAttribute('role', 'img');
  const canvas = el('canvas');
  canvas.width = MAP_SIZE_PX;
  canvas.height = MAP_SIZE_PX;
  root.append(canvas);
  const ctx = canvas.getContext?.('2d') ?? null;

  let terrain = null;
  let half = 1;
  let pois = [];
  let tile = null; // the relief, drawn once per site on a canvas of its own
  let last = null; // the robot pose last drawn, so an idle rover costs nothing

  function paintTile() {
    tile = null;
    if (!ctx || !terrain) return;
    const image = new ImageData(renderTerrainTile(terrain, MAP_SIZE_PX, half), MAP_SIZE_PX, MAP_SIZE_PX);
    tile = el('canvas');
    tile.width = MAP_SIZE_PX;
    tile.height = MAP_SIZE_PX;
    tile.getContext('2d').putImageData(image, 0, 0);
  }

  function dot(x, z, radius, color) {
    const { px, py } = sceneToMap(x, z, half);
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function draw(robot) {
    if (!ctx || !terrain) return;
    ctx.clearRect(0, 0, MAP_SIZE_PX, MAP_SIZE_PX);
    if (tile) ctx.drawImage(tile, 0, 0);
    for (const poi of pois) {
      if (poi.id === 'high') dot(poi.x, poi.z, 2.5, '#e5e0d5');
      else if (poi.id === 'low') dot(poi.x, poi.z, 2.5, '#6f6b61');
    }
    const lander = sceneToMap(0, 0, half);
    const me = sceneToMap(robot.x, robot.z, half);
    if (Math.hypot(me.px - lander.px, me.py - lander.py) > 3) {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#d4ad5bcc';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(me.px, me.py);
      ctx.lineTo(lander.px, lander.py);
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(lander.px, lander.py, 5, 0, 2 * Math.PI);
    ctx.strokeStyle = '#d4ad5b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.translate(me.px, me.py);
    ctx.rotate(robot.headingDeg * RAD); // heading is clockwise from north, which is up on the map
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#090909';
    ctx.lineWidth = 1.2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  return {
    el: root,
    setTerrain(nextTerrain, nextPois = []) {
      terrain = nextTerrain;
      half = mapHalfExtentM(terrain);
      pois = nextPois;
      last = null;
      paintTile();
    },
    /** Redraw if the rover moved (about half a metre) or turned (a degree) since the last time. */
    update(robot) {
      if (last && Math.hypot(robot.x - last.x, robot.z - last.z) < 0.5 && Math.abs(robot.headingDeg - last.headingDeg) < 1) return;
      last = { x: robot.x, z: robot.z, headingDeg: robot.headingDeg };
      draw(robot);
    },
    setHidden(hidden) {
      root.hidden = Boolean(hidden);
    },
    refreshTexts() {
      root.setAttribute('aria-label', t('minimap.label'));
    },
  };
}
