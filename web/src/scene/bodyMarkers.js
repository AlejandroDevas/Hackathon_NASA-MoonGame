import * as THREE from 'three';
import { t } from '../i18n.js';

/** Gap (px) between a marker and the edge of the free area of the screen. */
const EDGE_PAD_PX = 26;

/**
 * Where to draw the marker of a body the camera is not looking at. `view` is the body's position in camera
 * space (x right, y up, the camera looks down -z); `area` is the free rectangle of the screen, in pixels.
 * Returns null when the body is inside that rectangle (nothing to point at), otherwise the point of the
 * rectangle's edge that lies in the body's direction and the angle (degrees, 0 = right, clockwise) to point at.
 * A body behind the camera still gets a marker, on the same side as its direction.
 * @param {{x: number, y: number, z: number}} view
 * @param {{left: number, top: number, right: number, bottom: number}} area
 * @param {number} fovScale screen pixels per unit of x/y at depth 1 (half the height over tan(fov / 2))
 * @param {{x: number, y: number}} centre screen centre in pixels
 */
export function edgeMarker(view, area, fovScale, centre) {
  const inFront = view.z < 0;
  let dx = view.x;
  let dy = 0 - view.y; // screen y grows downwards (0 - y, so a zero stays +0 and atan2 never answers -180)
  if (inFront) {
    const px = centre.x + (view.x / -view.z) * fovScale;
    const py = centre.y - (view.y / -view.z) * fovScale;
    if (px >= area.left && px <= area.right && py >= area.top && py <= area.bottom) return null;
  }
  if (Math.hypot(dx, dy) < 1e-6) dy = 1; // straight behind: point down
  const length = Math.hypot(dx, dy);
  dx /= length;
  dy /= length;
  const halfW = (area.right - area.left) / 2;
  const halfH = (area.bottom - area.top) / 2;
  const cx = (area.left + area.right) / 2;
  const cy = (area.top + area.bottom) / 2;
  const reach = Math.min(Math.abs(dx) > 1e-9 ? halfW / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-9 ? halfH / Math.abs(dy) : Infinity);
  return { x: cx + dx * reach, y: cy + dy * reach, angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI };
}

/**
 * Slide a marker along the edge it sits on until it no longer covers any of the `rects` (HUD panels such as
 * the minimap), keeping it inside `area`. `halfW` and `halfH` are half the marker's size.
 * @param {{x: number, y: number}} point centre of the marker
 * @param {Array<{left: number, top: number, right: number, bottom: number}>} rects
 */
export function avoidRects(point, halfW, halfH, rects, area, gap = 8) {
  let { x, y } = point;
  const alongTop = y <= area.top + 1 || y >= area.bottom - 1; // on a horizontal edge: slide sideways
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const overlaps = (r, px, py) => !(px + halfW < r.left || px - halfW > r.right || py + halfH < r.top || py - halfH > r.bottom);
  for (const r of rects) {
    if (!overlaps(r, x, y)) continue;
    // the two ways out, the nearer one first; take the first that, kept inside the area, really clears the panel
    const before = alongTop ? r.left - halfW - gap : r.top - halfH - gap;
    const after = alongTop ? r.right + halfW + gap : r.bottom + halfH + gap;
    const current = alongTop ? x : y;
    const middle = alongTop ? (r.left + r.right) / 2 : (r.top + r.bottom) / 2;
    const ways = current < middle ? [before, after] : [after, before];
    for (const way of ways) {
      const fitted = alongTop ? clamp(way, area.left, area.right) : clamp(way, area.top, area.bottom);
      const clear = alongTop ? !overlaps(r, fitted, y) : !overlaps(r, x, fitted);
      if (clear || way === ways[1]) {
        if (alongTop) x = fitted;
        else y = fitted;
        break;
      }
    }
  }
  return { x: clamp(x, area.left, area.right), y: clamp(y, area.top, area.bottom) };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Markers at the edge of the 3D view that point to the Sun and to the Earth while they are above the horizon
 * but out of the picture, so the visitor knows which way to turn. They stay clear of the bars.
 * @param {HTMLElement} hud
 * @param {{obstacles?: () => Array<HTMLElement|null>}} [options] `obstacles` lists the HUD panels a marker must not cover
 */
export function createBodyMarkers(hud, { obstacles = () => [] } = {}) {
  const layer = el('div', 'scene-bodies');
  layer.setAttribute('aria-hidden', 'true'); // the readout panel already says where they are
  hud.append(layer);
  const bodies = ['sun', 'earth'].map((id) => {
    const root = el('div', `scene-body scene-body-${id}`);
    root.hidden = true;
    const arrow = el('span', 'scene-body-arrow');
    const dot = el('span', 'scene-body-dot');
    const name = el('span', 'scene-body-name');
    root.append(dot, name, arrow);
    layer.append(root);
    return { id, root, arrow, name, visible: false };
  });
  const view = new THREE.Vector3();
  let insets = { top: 0, bottom: 0 };
  let insetsFor = '';

  function readInsets(width, height) {
    const key = `${width}x${height}`;
    if (key === insetsFor) return;
    insetsFor = key;
    const style = getComputedStyle(document.documentElement);
    const px = (name) => Number.parseFloat(style.getPropertyValue(name)) || 0;
    insets = { top: px('--topbar-h'), bottom: px('--playbar-h') };
  }

  /** Say whether each body is above the horizon (only those get a marker) and refresh the labels. */
  function setVisible({ sun, earth }) {
    bodies[0].visible = sun;
    bodies[1].visible = earth;
    for (const body of bodies) body.name.textContent = t(`sky.${body.id}`);
  }

  /** Place the markers for the current camera; `positions` holds the world position of the 'sun' and 'earth'. */
  function update(camera, width, height, positions) {
    readInsets(width, height);
    const fovScale = height / 2 / Math.tan((camera.fov * Math.PI) / 360);
    // the screen is the whole canvas; only the markers keep inside the free `area`
    const centre = { x: width / 2, y: height / 2 };
    let rects = null; // measured only if a marker needs placing, and not more than once per frame
    for (const body of bodies) {
      // the area for the marker's centre: its whole box stays on screen and clear of the bars
      const halfW = (body.root.offsetWidth || 64) / 2;
      const halfH = (body.root.offsetHeight || 22) / 2;
      const area = {
        left: halfW + EDGE_PAD_PX / 3,
        right: width - halfW - EDGE_PAD_PX / 3,
        top: insets.top + halfH + EDGE_PAD_PX / 2,
        bottom: height - insets.bottom - halfH - EDGE_PAD_PX / 2,
      };
      const marker = body.visible ? edgeMarker(view.copy(positions[body.id]).applyMatrix4(camera.matrixWorldInverse), area, fovScale, centre) : null;
      body.root.hidden = marker === null;
      if (marker === null) continue;
      if (rects === null) {
        const origin = hud.getBoundingClientRect();
        rects = obstacles()
          .filter(Boolean)
          .map((node) => node.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.height > 0)
          .map((r) => ({ left: r.left - origin.left, right: r.right - origin.left, top: r.top - origin.top, bottom: r.bottom - origin.top }));
      }
      const spot = avoidRects(marker, halfW, halfH, rects, area);
      marker.x = spot.x;
      marker.y = spot.y;
      body.root.style.transform = `translate(${marker.x.toFixed(1)}px, ${marker.y.toFixed(1)}px) translate(-50%, -50%)`;
      body.arrow.style.transform = `rotate(${marker.angleDeg.toFixed(1)}deg)`;
    }
  }

  return { setVisible, update, el: layer };
}
