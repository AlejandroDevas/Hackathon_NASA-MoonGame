import * as THREE from 'three';
import { t } from '../i18n.js';
import { relativeTo } from './pois.js';

/** Height (m) of the beacon pole above the ground; the tag hangs at its tip. */
export const BEACON_HEIGHT_M = 40;
/** Height (m) above the ground where a landmark's label hangs: just over the lander, or the tip of a beacon. */
export const tagHeightM = (poi) => (poi.id === 'goal' ? 11 : BEACON_HEIGHT_M + 4);
const BEACON_COLORS = { goal: 0xd4ad5b, high: 0xe5e0d5, low: 0x8a877e };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Thin beacon poles that mark each landmark, visible from far away in the dark.
 * Unlit material, so they read the same whatever the Sun does.
 * @param {Array<{id: string, x: number, z: number}>} pois
 * @param {(x: number, z: number) => number} heightAt
 */
export function buildPoiMarkers(pois, heightAt) {
  const group = new THREE.Group();
  group.name = 'pois';
  for (const poi of pois) {
    if (poi.id === 'goal') continue; // the lander itself marks the landing zone
    const color = BEACON_COLORS[poi.id] ?? 0xffffff;
    const base = heightAt(poi.x, poi.z);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, BEACON_HEIGHT_M, 8),
      new THREE.MeshBasicMaterial({ color }),
    );
    pole.position.set(poi.x, base + BEACON_HEIGHT_M / 2, poi.z);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 12), new THREE.MeshBasicMaterial({ color }));
    cap.position.set(poi.x, base + BEACON_HEIGHT_M + 1.8, poi.z);
    pole.userData.poi = poi.id;
    group.add(pole, cap);
  }
  return group;
}

/**
 * Floating HTML labels over the 3D view, one per landmark, plus a visually hidden
 * list with the same information for assistive technology. The labels follow the
 * landmarks on screen and show the live distance from the robot.
 * @param {HTMLElement} hud
 */
export function createPoiTags(hud) {
  const layer = el('div', 'scene-tags');
  layer.setAttribute('aria-hidden', 'true');
  const srList = el('ul', 'sr-only');
  hud.append(layer, srList);
  const projected = new THREE.Vector3();
  let tags = [];

  function setPois(pois, baseHeight) {
    layer.replaceChildren();
    srList.replaceChildren();
    tags = pois.map((poi) => {
      const root = el('div', `scene-tag scene-tag-${poi.id}`);
      const name = el('span', 'scene-tag-name', t(`poi.${poi.id}`));
      const detail = el('span', 'scene-tag-detail');
      root.append(name, detail);
      layer.append(root);
      const fromSite = relativeTo(poi, { x: 0, z: 0 });
      srList.append(
        el(
          'li',
          '',
          poi.id === 'goal'
            ? t('poi.srGoal', { name: t('poi.goal'), elev: Math.round(baseHeight(poi)) })
            : t('poi.sr', {
                name: t(`poi.${poi.id}`),
                elev: Math.round(poi.heightM),
                dist: Math.round(fromSite.distanceM),
                dir: t(`compass.${fromSite.compass}`),
              }),
        ),
      );
      return { poi, root, detail, shownDistance: null };
    });
  }

  /** Position the labels for the current camera; `robot` gives the live distance. */
  function update(camera, width, height, robot, baseHeight) {
    for (const tag of tags) {
      const { poi } = tag;
      projected.set(poi.x, baseHeight(poi) + tagHeightM(poi), poi.z).project(camera);
      const onScreen = projected.z < 1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05;
      tag.root.hidden = !onScreen;
      if (!onScreen) continue;
      const px = ((projected.x + 1) / 2) * width;
      const py = ((1 - projected.y) / 2) * height;
      tag.root.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -100%)`;
      const distance = Math.round(relativeTo(poi, robot).distanceM);
      if (distance !== tag.shownDistance) {
        tag.shownDistance = distance;
        tag.detail.textContent =
          poi.id === 'goal'
            ? t('poi.detailGoal', { dist: distance })
            : t('poi.detail', { elev: Math.round(poi.heightM), dist: distance });
      }
    }
  }

  return { setPois, update, el: layer };
}
