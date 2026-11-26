import { t } from '../i18n.js';

/** Which controls the pad shows, and the key of their accessible name. */
const BUTTONS = [
  { name: 'forward', glyph: '▲', label: 'touch.forward', area: 'up' },
  { name: 'left', glyph: '◀', label: 'touch.left', area: 'left' },
  { name: 'right', glyph: '▶', label: 'touch.right', area: 'right' },
  { name: 'backward', glyph: '▼', label: 'touch.backward', area: 'down' },
];

/**
 * True on a phone or tablet: the main pointer is a finger, or the device reports touch and the
 * screen is narrow (which is also how the browser's device emulation looks).
 * @param {{matchMedia?: Function, navigator?: {maxTouchPoints?: number}, innerWidth?: number}} [env]
 */
export function isTouchDevice(env = window) {
  const coarse = env.matchMedia?.('(hover: none) and (pointer: coarse)').matches ?? false;
  const touchy = (env.navigator?.maxTouchPoints ?? 0) > 0 && (env.innerWidth ?? Infinity) <= 900;
  return coarse || touchy;
}

/** How far (0..1 of the radius) the stick must be pushed before it counts: a small slip of the thumb does nothing. */
export const STICK_DEAD_ZONE = 0.3;
/** How far (as a share of the stick's radius) the knob travels from the centre at full push. */
const KNOB_TRAVEL = 0.55;

/**
 * Which of the four drive controls a stick push (dx right, dy down, both -1..1 of the radius) presses.
 * A diagonal presses two, so the rover can go forward and turn at once.
 */
export function stickPresses(dx, dy, dead = STICK_DEAD_ZONE) {
  return { forward: dy < -dead, backward: dy > dead, left: dx < -dead, right: dx > dead };
}

/**
 * An on-screen joystick and a turbo switch that drive the rover where there is no keyboard. The stick is held
 * with one thumb: push forward to drive, sideways to turn, diagonally for both. The four arrow buttons stay in
 * the page, out of sight, as the way into the same controls for a screen reader or a switch device; each one
 * is held with its own finger.
 * @param {{setVirtual(name: string, pressed: boolean): void}} input
 * @returns {{el: HTMLElement, refreshTexts(): void, release(): void, dispose(): void}}
 */
export function createTouchControls(input) {
  const root = document.createElement('div');
  root.className = 'scene-touch';
  root.setAttribute('role', 'group');
  const buttons = new Map();

  function bindHold(button, name, { toggle = false } = {}) {
    const held = new Set(); // pointer ids currently holding this button
    const apply = () => {
      const on = toggle ? button.getAttribute('aria-pressed') === 'true' : held.size > 0;
      if (!toggle) button.classList.toggle('held', on);
      input.setVirtual(name, on);
    };
    if (toggle) {
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
        apply();
      });
      return { release: () => {} };
    }
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      held.add(event.pointerId);
      apply();
    });
    const up = (event) => {
      held.delete(event.pointerId);
      apply();
    };
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', up);
    button.addEventListener('contextmenu', (event) => event.preventDefault()); // a long press must not open a menu
    return {
      release() {
        held.clear();
        apply();
      },
    };
  }

  const pad = document.createElement('div');
  pad.className = 'scene-touch-pad';
  const holds = [];
  for (const spec of BUTTONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `scene-touch-btn scene-touch-${spec.area}`;
    button.textContent = spec.glyph;
    button.dataset.touch = spec.name;
    holds.push(bindHold(button, spec.name));
    buttons.set(spec.label, button);
    pad.append(button);
  }
  const boost = document.createElement('button');
  boost.type = 'button';
  boost.className = 'scene-touch-btn scene-touch-boost';
  boost.dataset.touch = 'boost';
  bindHold(boost, 'boost', { toggle: true });
  buttons.set('touch.boost', boost);
  // the joystick: a base to touch and a knob that follows the thumb
  const stick = document.createElement('div');
  stick.className = 'scene-touch-stick';
  const knob = document.createElement('div');
  knob.className = 'scene-touch-knob';
  stick.append(knob);
  let stickPointer = null;

  function stickSet(pressed) {
    for (const [name, on] of Object.entries(pressed)) input.setVirtual(name, on);
  }
  function stickMove(event) {
    const rect = stick.getBoundingClientRect();
    const radius = rect.width / 2;
    if (!(radius > 0)) return;
    let dx = (event.clientX - (rect.left + radius)) / radius;
    let dy = (event.clientY - (rect.top + radius)) / radius;
    const length = Math.hypot(dx, dy);
    if (length > 1) {
      dx /= length;
      dy /= length;
    }
    knob.style.transform = `translate(${(dx * radius * KNOB_TRAVEL).toFixed(1)}px, ${(dy * radius * KNOB_TRAVEL).toFixed(1)}px)`;
    stickSet(stickPresses(dx, dy));
  }
  function stickRelease() {
    stickPointer = null;
    knob.style.transform = '';
    stick.classList.remove('held');
    stickSet({ forward: false, backward: false, left: false, right: false });
  }
  stick.addEventListener('pointerdown', (event) => {
    if (stickPointer !== null) return; // one thumb at a time
    event.preventDefault();
    stickPointer = event.pointerId;
    stick.setPointerCapture?.(event.pointerId);
    stick.classList.add('held');
    stickMove(event);
  });
  stick.addEventListener('pointermove', (event) => {
    if (event.pointerId === stickPointer) stickMove(event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stick.addEventListener(type, (event) => {
      if (event.pointerId === stickPointer) stickRelease();
    });
  }
  stick.addEventListener('contextmenu', (event) => event.preventDefault());

  root.append(stick, pad, boost);

  function refreshTexts() {
    for (const [key, button] of buttons) {
      button.setAttribute('aria-label', t(key));
      if (key === 'touch.boost') button.textContent = t(key);
    }
  }
  refreshTexts();

  return {
    el: root,
    refreshTexts,
    /** Let go of everything (the page lost focus, or the view is being closed). */
    release() {
      stickRelease();
      for (const hold of holds) hold.release();
      boost.setAttribute('aria-pressed', 'false');
      input.setVirtual('boost', false);
    },
    dispose() {
      this.release();
      root.remove();
    },
  };
}
