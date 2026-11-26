import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ensureTerrain } from '../data/siteData.js';
import { getLocale, t } from '../i18n.js';
import { siteOverview } from '../metrics/overview.js';
import { horizonAt } from '../metrics/visibility.js';
import { createBodyMarkers } from './bodyMarkers.js';
import { createInput } from './input.js';
import { createDust } from './dust.js';
import { loadEarthImage } from './earthTexture.js';
import { addDecor } from './decor.js';
import { buildPoiMarkers, createPoiTags } from './poiTags.js';
import { findPois } from './pois.js';
import { createRobotMesh, loadNasaRover } from './robotMesh.js';
import { createSignPanel } from './signPanel.js';
import { MAX_SLOPE_DEG, createRobot, followCamera, nextSignOpen, speedFraction, stepRobot } from './robot.js';
import { createSkyReadout } from './skyReadout.js';
import { skyAt } from './sky.js';
import { contains, heightAt, normalAt } from './terrainData.js';
import { createMinimap } from './minimap.js';
import { createQualityController, renderScaleFor } from './quality.js';
import { startFor } from './startPlan.js';
import { createTrip } from './trip.js';
import { createTouchControls, isTouchDevice } from './touchControls.js';
import { initialPixelRatio } from './pixelRatio.js';
import { DEFAULT_SHADOW_MAP_SIZE, SMALL_SHADOW_MAP_SIZE, createWorld } from './world.js';

const MAX_FRAME_S = 0.1;
const UP = new THREE.Vector3(0, 1, 0);

function inertHandle() {
  return {
    dispose() {},
    debug: { robot: () => null, setRobot() {}, sky: () => null, signOpen: () => false, project: () => null, camera: () => null, info: () => null, loadMs: () => null, world: () => null, lod: () => null, forceScale() {}, quality: () => null, timeRender: () => null },
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
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    showNotice(container, t('scene.noWebgl'));
    return inertHandle();
  }
  // Sharp on high-density screens; the governor lowers it if the view runs slowly.
  const devicePixelRatio = initialPixelRatio(window.devicePixelRatio);
  renderer.setPixelRatio(devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // The shadow map is only redrawn when the Sun, the robot or the terrain detail changes (see `shadowDirty`).
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

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
  const skyReadout = createSkyReadout();
  const tags = createPoiTags(hud); // first, so the HUD panels stay above the floating labels
  // the markers keep clear of the readout, the minimap and the (open) sign
  const bodyMarkers = createBodyMarkers(hud, {
    obstacles: () => [skyReadout.el, minimap.el, signOpen ? sign.el : null],
  });
  const loadingEl = el('div', 'scene-loading');
  loadingEl.setAttribute('role', 'status');
  loadingEl.hidden = true;
  const minimap = createMinimap();
  hud.append(help, blockedEl, routeEl, skyReadout.el, minimap.el, loadingEl, sign.el);
  container.append(hud);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 150_000);
  const input = createInput(window);
  // phones and tablets have no keyboard: an on-screen pad drives the rover instead
  const touch = isTouchDevice() ? createTouchControls(input) : null;
  if (touch) hud.append(touch.el);
  const robotMesh = createRobotMesh();

  const plans = new Map(); // site id -> planStart result, computed once per site (takes ~1 s)
  const poiCache = new Map(); // site id -> landmarks of the terrain
  const rockCache = new Map(); // site id -> boulder placements (positions only; meshes are rebuilt per world)
  let pois = [];
  let loadingId = null; // site whose terrain is being fetched
  let dust = null; // ballistic dust thrown up by the rover, one per world
  const trip = createTrip(); // metres and time until the rover first reaches the lander
  let lastPos = null; // robot position in the previous frame, to know how far it drove
  let slopeLimitDeg = MAX_SLOPE_DEG;
  let siteId = null;
  let site = null;
  let world = null;
  let robot = null;
  let signOpen = false;
  let shownBlockReason = null;
  let lastSky = null;
  let frameHandle = null;
  let lastTime = null;
  let lastLoadMs = null; // how long the last site took to build (debug)
  // Frames are only drawn when something visible changed; the shadow map only when something that casts shadows did.
  let needsRender = true;
  let shadowDirty = true;
  const quality = createQualityController();
  let qualityIgnoreUntil = 0; // frames while a site is loading say nothing about steady-state speed
  let forcedScale = null; // debug: pin the render scale while measuring
  let qualityMode = store.get().quality ?? 'auto'; // the visitor's choice: auto, high, medium or low
  let dustWasFlying = false;
  let prevStamp = null; // timestamp of the previous frame, if it was drawn (for the frame-time samples)
  const lastCamPos = new THREE.Vector3(1e9, 1e9, 1e9);
  const lastCamQuat = new THREE.Quaternion();
  const scratch = new THREE.Vector3();
  let locale = null;
  let controls = null; // OrbitControls, created the first time the free view is used
  let viewMode = store.get().viewMode === 'free' ? 'free' : 'follow';

  /** Ask for a new frame, and for the shadow map to be redrawn too if `shadows` is true. */
  function invalidate(shadows = false) {
    needsRender = true;
    if (shadows) shadowDirty = true;
  }

  function setRobot(x, z, headingDeg) {
    robot = createRobot(site.terrain, x, z, headingDeg);
    placeRobotMesh();
    invalidate(true);
  }

  function loadSiteScene(id) {
    const loadStart = performance.now();
    if (world) {
      world.scene.remove(robotMesh);
      world.dispose();
    }
    siteId = id;
    site = sites.get(id);
    world = createWorld(site, {
      shadowMapSize:
        renderer.capabilities.maxTextureSize >= DEFAULT_SHADOW_MAP_SIZE[0] ? DEFAULT_SHADOW_MAP_SIZE : SMALL_SHADOW_MAP_SIZE,
    });
    world.setShadowLift(Boolean(store.get().shadowLift));
    world.setLrocTexture(store.get().lrocTexture !== false);
    world.scene.add(robotMesh);
    dust = createDust();
    world.scene.add(dust.mesh);
    // NASA's Earth image replaces the procedural surface once loaded (if this world is still on screen)
    const forWorld = world;
    loadEarthImage(`${import.meta.env.BASE_URL}textures/earth.jpg`).then((texture) => {
      if (!texture) return;
      if (world !== forWorld) texture.dispose();
      else {
        forWorld.setEarthMap(texture);
        invalidate();
      }
    });
    lastPos = null;
    if (!poiCache.has(id)) poiCache.set(id, findPois(site.terrain));
    pois = poiCache.get(id);
    minimap.setTerrain(site.terrain, pois);
    world.scene.add(buildPoiMarkers(pois, groundAt));
    if (!plans.has(id)) plans.set(id, startFor(site));
    const plan = plans.get(id);
    const decorWorld = world;
    addDecor({
      world,
      site,
      plan,
      rockCache,
      siteId: id,
      isCurrent: () => world === decorWorld,
      onChange: () => invalidate(true),
      modelUrl: `${import.meta.env.BASE_URL}models/apollo-lunar-module.glb`,
    });
    slopeLimitDeg = plan.limitDeg;
    setRobot(plan.x, plan.z, plan.headingDeg);
    routeEl.hidden = plan.reachable;
    signOpen = false;
    trip.reset();
    sign.setTrip(null);
    camera.position.set(robot.x, robot.y + 6, robot.z + 12);
    world.updateLod(camera.position, Infinity); // the first frame already has the detail around the robot
    applyTexts();
    applySky();
    invalidate(true);
    lastLoadMs = performance.now() - loadStart;
    qualityIgnoreUntil = performance.now() + 4000;
    prevStamp = null;
  }

  const groundAt = (x, z) => heightAt(site.terrain, x, z);
  const poiBase = (poi) => groundAt(poi.x, poi.z);

  function applySky() {
    lastSky = skyAt(site, store.get().scenarios.A.timeMs);
    world.updateSky(lastSky, store.get().scenarios.A.timeMs);
    skyReadout.update(site, lastSky);
    updateBodyMarkers();
    invalidate(true);
  }

  /** Only a body above the horizon of the terrain gets an edge marker (same rule as the sky readout). */
  function updateBodyMarkers() {
    if (!lastSky) return;
    const { bodies } = site.info;
    const above = (body, radiusDeg) => body.elDeg + radiusDeg > horizonAt(site.horizon, body.azDeg);
    bodyMarkers.setVisible({
      sun: above(lastSky.sun, bodies.sun_radius_deg),
      earth: above(lastSky.earth, bodies.earth_radius_deg),
    });
  }

  function applyTexts() {
    renderer.domElement.setAttribute('aria-label', t('scene.label'));
    // with the touch pad the keyboard keys are no use, and the pad takes the corner the long text would fill
    const driving = touch ? t('scene.helpTouch') : t('scene.help');
    help.textContent = `${driving} · ${t('scene.slopeLimit', { limit: slopeLimitDeg })}${
      viewMode === 'free' ? ` · ${t('scene.helpFree')}` : ''
    }`;
    touch?.refreshTexts();
    minimap.refreshTexts();
    shownBlockReason = null; // the warning text is rebuilt on the next frame in the new language
    routeEl.textContent = t('scene.noRoute');
    sign.setInfo(site.info, getLocale(), siteOverview(site));
    tags.setPois(pois, poiBase);
    if (lastSky) skyReadout.update(site, lastSky);
    updateBodyMarkers(); // the labels follow the language
  }

  /** Follow camera (default) or a free orbit around the rover. */
  function setViewMode(next) {
    viewMode = next === 'free' ? 'free' : 'follow';
    if (viewMode === 'free') {
      if (!controls) {
        controls = new OrbitControls(camera, renderer.domElement);
        Object.assign(controls, {
          enableDamping: true,
          dampingFactor: 0.06,
          minDistance: 8,
          maxDistance: 6000,
          maxPolarAngle: Math.PI / 2 - 0.01,
        });
      }
      controls.target.set(robot.x, robot.y + 1.5, robot.z);
      controls.enabled = true;
      renderer.domElement.style.touchAction = 'none';
    } else {
      if (controls) controls.enabled = false;
      renderer.domElement.style.touchAction = 'auto';
    }
    applyTexts();
  }

  /** The terrain of a site is fetched the first time it is chosen; show it once it arrives, if still wanted. */
  function showWhenLoaded(target, id) {
    if (loadingId === id) return;
    loadingId = id;
    help.textContent = t('scene.loading');
    loadingEl.textContent = t('scene.loading');
    loadingEl.hidden = false;
    ensureTerrain(target).then(
      () => {
        loadingId = null;
        loadingEl.hidden = true;
        if (store.get().scenarios.A.siteId === id && id !== siteId) loadSiteScene(id);
        else applyTexts();
      },
      (error) => {
        loadingId = null;
        loadingEl.hidden = true;
        console.warn(`Terrain of ${id} could not be loaded.`, error);
        applyTexts();
      },
    );
  }

  function resize() {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    renderer.setPixelRatio(forcedScale ?? devicePixelRatio * renderScaleFor(qualityMode, quality.scale));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    invalidate();
  }

  function placeRobotMesh() {
    robotMesh.position.set(robot.x, robot.y, robot.z);
    const n = normalAt(site.terrain, robot.x, robot.z);
    const tilt = new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(n.x, n.y, n.z));
    const yaw = new THREE.Quaternion().setFromAxisAngle(UP, (-robot.headingDeg * Math.PI) / 180);
    robotMesh.quaternion.copy(tilt).multiply(yaw);
  }

  /** Grains from the rear wheels while the rover drives; they fly on lunar-gravity parabolas. */
  function throwDust(dt) {
    let speed = 0;
    if (dt > 0 && lastPos) {
      const dx = robot.x - lastPos.x;
      const dz = robot.z - lastPos.z;
      const moved = Math.hypot(dx, dz);
      speed = speedFraction(moved, dt);
      if (moved > 0.001 && moved < 6) {
        dust.emitFromWheels(robot, moved, dx / moved, dz / moved, moved / dt);
        trip.addDistance(moved);
      }
    }
    audioCue?.setRoverSpeed?.(speed); // the motor is heard through the chassis only while driving
    lastPos = { x: robot.x, z: robot.z };
    if (dust.sim.count() > 0) dust.update(dt, groundAt);
  }

  function frame(timestamp) {
    frameHandle = requestAnimationFrame(frame);
    const dt = lastTime === null ? 0 : Math.min((timestamp - lastTime) / 1000, MAX_FRAME_S);
    lastTime = timestamp;

    const { x: beforeX, z: beforeZ, headingDeg: beforeHeading } = robot;
    robot = stepRobot(robot, input.read(), site.terrain, dt, slopeLimitDeg);
    trip.tick(dt);
    const robotMoved = robot.x !== beforeX || robot.z !== beforeZ || robot.headingDeg !== beforeHeading;
    if (robotMoved) placeRobotMesh();
    minimap.update(robot); // redraws only when the rover moved or turned
    throwDust(dt);

    const k = 1 - Math.exp(-6 * dt);
    if (viewMode === 'free' && controls) {
      scratch.set(robot.x, robot.y + 1.5, robot.z);
      controls.target.lerp(scratch, k);
      controls.update();
      if (contains(site.terrain, camera.position.x, camera.position.z)) {
        camera.position.y = Math.max(camera.position.y, groundAt(camera.position.x, camera.position.z) + 2);
      }
    } else {
      const pose = followCamera(robot);
      scratch.set(pose.position.x, pose.position.y, pose.position.z);
      camera.position.lerp(scratch, k);
      if (contains(site.terrain, camera.position.x, camera.position.z)) {
        camera.position.y = Math.max(camera.position.y, groundAt(camera.position.x, camera.position.z) + 1.5);
      }
      camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
    }
    if (world.updateLod(camera.position)) invalidate(true);

    const wasOpen = signOpen;
    signOpen = nextSignOpen(signOpen, Math.hypot(robot.x, robot.z));
    if (signOpen && !wasOpen) {
      audioCue?.play('radio'); // the rover reports in from the lander
      sign.setTrip(trip.arrive());
    }
    sign.setOpen(signOpen);
    minimap.setHidden(signOpen); // the sign takes that corner
    if (robot.blockedBy !== shownBlockReason) {
      shownBlockReason = robot.blockedBy;
      if (shownBlockReason) {
        blockedEl.textContent =
          shownBlockReason === 'edge' ? t('scene.blockedEdge') : t('scene.blocked', { limit: slopeLimitDeg });
      }
    }
    blockedEl.hidden = !robot.blocked;

    if (robotMoved) invalidate(true);
    const cameraMoved =
      lastCamPos.distanceToSquared(camera.position) > 1e-8 || 1 - Math.abs(lastCamQuat.dot(camera.quaternion)) > 1e-10;
    const dustFlying = dust.sim.count() > 0;
    const dustChanged = dustFlying || dustWasFlying; // one more frame once the last grain has landed
    dustWasFlying = dustFlying;
    if (!needsRender && !cameraMoved && !dustChanged) {
      prevStamp = null; // an idle frame says nothing about how fast frames are drawn
      return;
    }

    if (shadowDirty) {
      renderer.shadowMap.needsUpdate = true;
      shadowDirty = false;
    }
    needsRender = false;
    lastCamPos.copy(camera.position);
    lastCamQuat.copy(camera.quaternion);
    tags.update(camera, container.clientWidth, container.clientHeight, robot, poiBase);
    bodyMarkers.update(camera, container.clientWidth, container.clientHeight, {
      sun: world.sunDisc.position,
      earth: world.earth.position,
    });
    renderer.render(world.scene, camera);

    if (prevStamp !== null && forcedScale === null && qualityMode === 'auto' && timestamp > qualityIgnoreUntil) {
      const scale = quality.record(timestamp - prevStamp, timestamp);
      if (scale !== null) resize();
    }
    prevStamp = timestamp;
  }

  const unsubscribe = store.subscribe((state) => {
    invalidate();
    const nextId = state.scenarios.A.siteId;
    const next = sites.get(nextId);
    if (nextId !== siteId && next?.terrain) loadSiteScene(nextId);
    else if (nextId !== siteId && next?.info?.terrain) showWhenLoaded(next, nextId);
    else if (next?.terrain) applySky();
    world.setShadowLift(Boolean(state.shadowLift));
    world.setLrocTexture(state.lrocTexture !== false);
    if (state.viewMode !== viewMode) setViewMode(state.viewMode);
    if ((state.quality ?? 'auto') !== qualityMode) {
      qualityMode = state.quality ?? 'auto';
      resize(); // the new render scale applies at once
    }
    if (state.locale !== locale) {
      locale = state.locale;
      applyTexts();
    }
  });

  // After a lost WebGL context is restored nothing is on screen: draw everything again (shadow map included).
  const onContextRestored = () => invalidate(true);
  renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  loadSiteScene(store.get().scenarios.A.siteId);
  loadNasaRover(robotMesh, `${import.meta.env.BASE_URL}models/perseverance-rover.glb`);
  locale = store.get().locale;
  setViewMode(viewMode);
  resize();
  frameHandle = requestAnimationFrame(frame);

  return {
    dispose() {
      cancelAnimationFrame(frameHandle);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      unsubscribe();
      observer.disconnect();
      touch?.dispose();
      input.dispose();
      audioCue?.dispose();
      controls?.dispose();
      robotMesh.removeFromParent();
      world.dispose();
      robotMesh.traverse((object) => {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          for (const value of Object.values(material ?? {})) {
            if (value?.isTexture) value.dispose();
          }
          material?.dispose();
        }
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
      /** Renderer statistics of the last frame: draw calls, triangles, and what is held on the GPU. */
      info: () => ({ ...renderer.info.render, ...renderer.info.memory }),
      loadMs: () => lastLoadMs,
      world: () => world,
      lod: () => world.terrain.stats(),
      /** Pin the render scale (null releases it) so that measurements are not changed by the adaptive controller. */
      forceScale(scale) {
        forcedScale = scale;
        resize();
      },
      quality: () => ({ scale: quality.scale, needsRender, shadowDirty }),
      /**
       * Mean cost in ms of one render of the current view, forcing the GPU to finish each time so the
       * frame-rate cap does not hide it. `shadows: false` skips the shadow-map pass, to see its share.
       */
      timeRender(n = 20, { shadows = true } = {}) {
        const gl = renderer.getContext();
        const wasAuto = renderer.shadowMap.autoUpdate;
        renderer.shadowMap.autoUpdate = shadows;
        renderer.shadowMap.needsUpdate = shadows;
        renderer.render(world.scene, camera); // warm up
        gl.finish();
        const start = performance.now();
        for (let i = 0; i < n; i++) {
          if (shadows) renderer.shadowMap.needsUpdate = true;
          renderer.render(world.scene, camera);
          gl.finish();
        }
        const ms = (performance.now() - start) / n;
        renderer.shadowMap.autoUpdate = wasAuto;
        return +ms.toFixed(2);
      },
      /** Normalised device coordinates of 'sun' or 'earth' (x, y in [-1, 1] when on screen; z > 1 when behind). */
      project(name) {
        const body = name === 'sun' ? world.sunDisc : world.earth;
        const p = body.position.clone().project(camera);
        return { x: p.x, y: p.y, z: p.z };
      },
    },
  };
}
