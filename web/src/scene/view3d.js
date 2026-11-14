import * as THREE from 'three';
import { getLocale, t } from '../i18n.js';
import { createInput } from './input.js';
import { createRobotMesh } from './robotMesh.js';
import { createSignPanel } from './signPanel.js';
import { MAX_SLOPE_DEG, createRobot, followCamera, nextSignOpen, stepRobot } from './robot.js';
import { skyAt } from './sky.js';
import { contains, heightAt, normalAt } from './terrainData.js';
import { planStart } from './traversal.js';
import { createWorld } from './world.js';

const MAX_FRAME_S = 0.1;
const START_DISTANCE_M = 400;
const UP = new THREE.Vector3(0, 1, 0);

function inertHandle() {
  return {
    dispose() {},
    debug: { robot: () => null, setRobot() {}, sky: () => null, signOpen: () => false, project: () => null, camera: () => null },
  };
}

function showNotice(container, text) {
  container.replaceChildren();
  container.classList.add('scene-root', 'scene-root-notice');
  const notice = document.createElement('div');
  notice.className = 'scene-notice';
  notice.textContent = text;
  container.append(notice);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Mount the 3D view of the site selected in scenario A. Sun and Earth follow the
 * scenario's date; the robot is driven with the keyboard. Without WebGL or terrain
 * it shows a notice and returns inert handles.
 * @param {HTMLElement} container
 * @param {{get(): object, subscribe(fn: Function): () => void}} store
 * @param {Map<string, object>} sites
 */
export function mountScene(container, store, sites, audioCue = null) {
  const first = sites.get(store.get().scenarios.A.siteId);
  if (!first?.terrain) {
    showNotice(container, t('scene.noTerrain'));
    return inertHandle();
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  } catch {
    showNotice(container, t('scene.noWebgl'));
    return inertHandle();
  }
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  container.replaceChildren();
  container.classList.add('scene-root');
  renderer.domElement.setAttribute('role', 'img');
  container.append(renderer.domElement);
  const hud = el('div', 'scene-hud');
  const help = el('div', 'scene-help');
  const blockedEl = el('div', 'scene-blocked');
  blockedEl.hidden = true;
  const sign = createSignPanel();
  const routeEl = el('div', 'scene-route');
  routeEl.hidden = true;
  hud.append(help, blockedEl, routeEl, sign.el);
  container.append(hud);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 200_000);
  const input = createInput(window);
  const robotMesh = createRobotMesh();

  const plans = new Map(); // site id -> planStart result, computed once per site (takes ~1 s)
  let slopeLimitDeg = MAX_SLOPE_DEG;
  let siteId = null;
  let site = null;
  let world = null;
  let robot = null;
  let signOpen = false;
  let lastSky = null;
  let frameHandle = null;
  let lastTime = null;
  let locale = null;

  function setRobot(x, z, headingDeg) {
    robot = createRobot(site.terrain, x, z, headingDeg);
  }

  function loadSiteScene(id) {
    if (world) {
      world.scene.remove(robotMesh);
      world.dispose();
    }
    siteId = id;
    site = sites.get(id);
    world = createWorld(site);
    world.scene.add(robotMesh);
    if (!plans.has(id)) plans.set(id, planStart(site.terrain, { x: 0, z: 0 }, START_DISTANCE_M));
    const plan = plans.get(id);
    slopeLimitDeg = plan.limitDeg;
    setRobot(plan.x, plan.z, plan.headingDeg);
    routeEl.hidden = plan.reachable;
    signOpen = false;
    camera.position.set(robot.x, robot.y + 6, robot.z + 12);
    applyTexts();
    applySky();
  }

  function applySky() {
    lastSky = skyAt(site, store.get().scenarios.A.timeMs);
    world.updateSky(lastSky);
  }

  function applyTexts() {
    renderer.domElement.setAttribute('aria-label', t('scene.label'));
    help.textContent = `${t('scene.help')} · ${t('scene.slopeLimit', { limit: slopeLimitDeg })}`;
    blockedEl.textContent = t('scene.blocked', { limit: slopeLimitDeg });
    routeEl.textContent = t('scene.noRoute');
    sign.setInfo(site.info, getLocale());
  }

  function resize() {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function placeRobotMesh() {
    robotMesh.position.set(robot.x, robot.y, robot.z);
    const n = normalAt(site.terrain, robot.x, robot.z);
    const tilt = new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(n.x, n.y, n.z));
    const yaw = new THREE.Quaternion().setFromAxisAngle(UP, (-robot.headingDeg * Math.PI) / 180);
    robotMesh.quaternion.copy(tilt).multiply(yaw);
  }

  function frame(timestamp) {
    frameHandle = requestAnimationFrame(frame);
    const dt = lastTime === null ? 0 : Math.min((timestamp - lastTime) / 1000, MAX_FRAME_S);
    lastTime = timestamp;

    robot = stepRobot(robot, input.read(), site.terrain, dt, slopeLimitDeg);
    placeRobotMesh();

    const pose = followCamera(robot);
    const k = 1 - Math.exp(-6 * dt);
    camera.position.lerp(new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z), k);
    if (contains(site.terrain, camera.position.x, camera.position.z)) {
      camera.position.y = Math.max(camera.position.y, heightAt(site.terrain, camera.position.x, camera.position.z) + 1.5);
    }
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z);

    const wasOpen = signOpen;
    signOpen = nextSignOpen(signOpen, Math.hypot(robot.x, robot.z));
    if (signOpen && !wasOpen) audioCue?.play();
    sign.setOpen(signOpen);
    blockedEl.hidden = !robot.blocked;
    renderer.render(world.scene, camera);
  }

  const unsubscribe = store.subscribe((state) => {
    const nextId = state.scenarios.A.siteId;
    if (nextId !== siteId && sites.get(nextId)?.terrain) loadSiteScene(nextId);
    else if (sites.get(nextId)?.terrain) applySky();
    if (state.locale !== locale) {
      locale = state.locale;
      applyTexts();
    }
  });

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  loadSiteScene(store.get().scenarios.A.siteId);
  locale = store.get().locale;
  applyTexts();
  resize();
  frameHandle = requestAnimationFrame(frame);

  return {
    dispose() {
      cancelAnimationFrame(frameHandle);
      unsubscribe();
      observer.disconnect();
      input.dispose();
      audioCue?.dispose();
      world.dispose();
      robotMesh.traverse((object) => {
        object.geometry?.dispose();
        object.material?.dispose();
      });
      renderer.dispose();
      container.replaceChildren();
    },
    debug: {
      robot: () => robot,
      setRobot,
      sky: () => lastSky,
      signOpen: () => signOpen,
      camera: () => camera.position.toArray(),
      /** Normalised device coordinates of 'sun' or 'earth' (x, y in [-1, 1] when on screen; z > 1 when behind). */
      project(name) {
        const body = name === 'sun' ? world.sunDisc : world.earth;
        const p = body.position.clone().project(camera);
        return { x: p.x, y: p.y, z: p.z };
      },
    },
  };
}
