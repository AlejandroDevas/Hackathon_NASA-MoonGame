import { afterEach, describe, expect, test } from 'vitest';
import { setLocale } from '../src/i18n.js';
import { createInput } from '../src/scene/input.js';
import { STICK_DEAD_ZONE, createTouchControls, isTouchDevice, stickPresses } from '../src/scene/touchControls.js';

afterEach(() => setLocale('es'));

const pointer = (type, pointerId = 1) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  event.pointerId = pointerId;
  return event;
};
const button = (controls, name) => controls.el.querySelector(`[data-touch="${name}"]`);

describe('createInput virtual controls', () => {
  test('an on-screen button drives like its key and releasing stops it', () => {
    const input = createInput(window);
    input.setVirtual('forward', true);
    input.setVirtual('right', true);
    expect(input.read()).toEqual({ forward: 1, turn: 1, boost: false });
    input.setVirtual('forward', false);
    expect(input.read()).toEqual({ forward: 0, turn: 1, boost: false });
    input.dispose();
  });

  test('a key and a button do not release each other', () => {
    const input = createInput(window);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    input.setVirtual('forward', true);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    expect(input.read().forward).toBe(1);
    input.dispose();
  });

  test('ignores a name it does not know and clears everything on blur', () => {
    const input = createInput(window);
    input.setVirtual('fly', true);
    input.setVirtual('boost', true);
    expect(input.read().boost).toBe(true);
    window.dispatchEvent(new Event('blur'));
    expect(input.read()).toEqual({ forward: 0, turn: 0, boost: false });
    input.dispose();
  });
});

describe('createTouchControls', () => {
  function setup() {
    const input = createInput(window);
    const controls = createTouchControls(input);
    document.body.append(controls.el);
    return { input, controls };
  }

  test('holding an arrow drives and letting go stops', () => {
    const { input, controls } = setup();
    button(controls, 'forward').dispatchEvent(pointer('pointerdown'));
    expect(input.read().forward).toBe(1);
    button(controls, 'forward').dispatchEvent(pointer('pointerup'));
    expect(input.read().forward).toBe(0);
    controls.dispose();
    input.dispose();
  });

  test('two fingers can drive forward and turn at the same time', () => {
    const { input, controls } = setup();
    button(controls, 'forward').dispatchEvent(pointer('pointerdown', 1));
    button(controls, 'left').dispatchEvent(pointer('pointerdown', 2));
    expect(input.read()).toEqual({ forward: 1, turn: -1, boost: false });
    controls.dispose();
    input.dispose();
  });

  test('a cancelled touch releases the button', () => {
    const { input, controls } = setup();
    button(controls, 'backward').dispatchEvent(pointer('pointerdown'));
    button(controls, 'backward').dispatchEvent(pointer('pointercancel'));
    expect(input.read().forward).toBe(0);
    controls.dispose();
    input.dispose();
  });

  test('turbo is a switch: one tap on, another off', () => {
    const { input, controls } = setup();
    button(controls, 'boost').click();
    expect(button(controls, 'boost').getAttribute('aria-pressed')).toBe('true');
    expect(input.read().boost).toBe(true);
    button(controls, 'boost').click();
    expect(input.read().boost).toBe(false);
    controls.dispose();
    input.dispose();
  });

  test('release lets go of every button', () => {
    const { input, controls } = setup();
    button(controls, 'forward').dispatchEvent(pointer('pointerdown'));
    button(controls, 'boost').click();
    controls.release();
    expect(input.read()).toEqual({ forward: 0, turn: 0, boost: false });
    controls.dispose();
    input.dispose();
  });

  test('every button has an accessible name in the active language', () => {
    const { controls } = setup();
    expect(button(controls, 'left').getAttribute('aria-label')).toBe('Girar a la izquierda');
    setLocale('en');
    controls.refreshTexts();
    expect(button(controls, 'left').getAttribute('aria-label')).toBe('Turn left');
    controls.dispose();
  });
});

describe('stickPresses', () => {
  test('inside the dead zone nothing is pressed', () => {
    expect(stickPresses(0.1, -0.1)).toEqual({ forward: false, backward: false, left: false, right: false });
    expect(stickPresses(0, -STICK_DEAD_ZONE)).toEqual({ forward: false, backward: false, left: false, right: false });
  });

  test('pushing up drives forward, down backs up, sideways turns', () => {
    expect(stickPresses(0, -1)).toMatchObject({ forward: true, backward: false, left: false, right: false });
    expect(stickPresses(0, 1)).toMatchObject({ forward: false, backward: true });
    expect(stickPresses(-1, 0)).toMatchObject({ left: true, right: false });
    expect(stickPresses(1, 0)).toMatchObject({ left: false, right: true });
  });

  test('a diagonal presses two controls, so the rover drives and turns at once', () => {
    expect(stickPresses(0.7, -0.7)).toMatchObject({ forward: true, right: true });
  });
});

describe('the joystick', () => {
  // the stick is 100 px wide and sits at (0, 0): its centre is (50, 50)
  function setup() {
    const input = createInput(window);
    const controls = createTouchControls(input);
    document.body.append(controls.el);
    const stick = controls.el.querySelector('.scene-touch-stick');
    stick.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 });
    return { input, controls, stick };
  }
  const at = (type, x, y, pointerId = 1) => {
    const event = pointer(type, pointerId);
    event.clientX = x;
    event.clientY = y;
    return event;
  };

  test('pushing the knob up drives forward, and letting go stops and brings the knob back', () => {
    const { input, controls, stick } = setup();
    stick.dispatchEvent(at('pointerdown', 50, 0));
    expect(input.read()).toEqual({ forward: 1, turn: 0, boost: false });
    expect(stick.querySelector('.scene-touch-knob').style.transform).toContain('-27.5px'); // the full travel
    stick.dispatchEvent(at('pointerup', 50, 0));
    expect(input.read()).toEqual({ forward: 0, turn: 0, boost: false });
    expect(stick.querySelector('.scene-touch-knob').style.transform).toBe('');
    controls.dispose();
    input.dispose();
  });

  test('sliding the thumb round changes what is pressed: forward and right, then back', () => {
    const { input, controls, stick } = setup();
    stick.dispatchEvent(at('pointerdown', 50, 50)); // the centre: dead zone
    expect(input.read()).toEqual({ forward: 0, turn: 0, boost: false });
    stick.dispatchEvent(at('pointermove', 90, 10));
    expect(input.read()).toEqual({ forward: 1, turn: 1, boost: false });
    stick.dispatchEvent(at('pointermove', 50, 95));
    expect(input.read()).toEqual({ forward: -1, turn: 0, boost: false });
    controls.dispose();
    input.dispose();
  });

  test('pulling the thumb far outside still counts as a full push, not more', () => {
    const { input, controls, stick } = setup();
    stick.dispatchEvent(at('pointerdown', 50, 50));
    stick.dispatchEvent(at('pointermove', 900, 50));
    expect(input.read().turn).toBe(1);
    expect(stick.querySelector('.scene-touch-knob').style.transform).toContain('27.5px');
    controls.dispose();
    input.dispose();
  });

  test('a second finger does not take over the stick, and a cancelled touch releases it', () => {
    const { input, controls, stick } = setup();
    stick.dispatchEvent(at('pointerdown', 50, 5, 1));
    stick.dispatchEvent(at('pointerdown', 5, 50, 2)); // ignored
    stick.dispatchEvent(at('pointermove', 5, 50, 2)); // ignored
    expect(input.read()).toEqual({ forward: 1, turn: 0, boost: false });
    stick.dispatchEvent(at('pointercancel', 50, 5, 1));
    expect(input.read()).toEqual({ forward: 0, turn: 0, boost: false });
    controls.dispose();
    input.dispose();
  });

  test('the stick and the turbo switch work together, and release lets go of both', () => {
    const { input, controls, stick } = setup();
    button(controls, 'boost').click();
    stick.dispatchEvent(at('pointerdown', 50, 5));
    expect(input.read()).toEqual({ forward: 1, turn: 0, boost: true });
    controls.release();
    expect(input.read()).toEqual({ forward: 0, turn: 0, boost: false });
    controls.dispose();
    input.dispose();
  });

  test('the arrow buttons are still there, out of sight, for assistive technology', () => {
    const { controls } = setup();
    expect(controls.el.querySelectorAll('.scene-touch-pad button')).toHaveLength(4);
    controls.dispose();
  });
});

describe('isTouchDevice', () => {
  test('a coarse main pointer is a touch device', () => {
    expect(isTouchDevice({ matchMedia: () => ({ matches: true }) })).toBe(true);
  });

  test('a narrow screen that reports touch points is one too', () => {
    expect(isTouchDevice({ matchMedia: () => ({ matches: false }), navigator: { maxTouchPoints: 5 }, innerWidth: 375 })).toBe(true);
  });

  test('a desktop with a mouse is not, even when it has a touch screen wider than a tablet', () => {
    expect(isTouchDevice({ matchMedia: () => ({ matches: false }), navigator: { maxTouchPoints: 10 }, innerWidth: 1920 })).toBe(false);
    expect(isTouchDevice({ matchMedia: () => ({ matches: false }), navigator: { maxTouchPoints: 0 }, innerWidth: 375 })).toBe(false);
  });
});
