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

/**
 * An on-screen pad (arrows and a turbo switch) that drives the rover where there is no keyboard.
 * Every button is held with its own finger, so forward and turn can be pressed together.
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
  root.append(pad, boost);

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
