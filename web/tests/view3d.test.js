import { afterEach, describe, expect, test, vi } from 'vitest';
import { setLocale } from '../src/i18n.js';
import { DEFAULT_THRESHOLDS } from '../src/metrics/scenario.js';
import { createInput } from '../src/scene/input.js';
import { createRobotMesh } from '../src/scene/robotMesh.js';
import { mountScene } from '../src/scene/view3d.js';
import { createStore } from '../src/state.js';
import es from '../src/strings/es.json';
import { HOUR, T0, loadTinySite } from './helpers.js';

afterEach(() => {
  setLocale('es');
  vi.restoreAllMocks();
});

function storeFor(siteId) {
  return createStore({
    scenarios: { A: { siteId, timeMs: T0 + 5 * HOUR }, B: null },
    windowMs: 24 * HOUR,
    thresholds: { ...DEFAULT_THRESHOLDS },
    playing: false,
    locale: 'es',
  });
}

describe('mountScene fallbacks (jsdom has no WebGL)', () => {
  test('without WebGL it shows a notice and returns inert handles, without throwing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = document.createElement('div');
    const site = loadTinySite();
    const scene = mountScene(container, storeFor('tiny-site'), new Map([['tiny-site', site]]));
    expect(container.textContent).toContain(es['scene.noWebgl']);
    expect(() => scene.dispose()).not.toThrow();
    expect(scene.debug.robot()).toBeNull();
    expect(scene.debug.signOpen()).toBe(false);
  });

  test('a site without terrain shows its own notice', () => {
    const container = document.createElement('div');
    const site = { ...loadTinySite(), terrain: null };
    mountScene(container, storeFor('tiny-site'), new Map([['tiny-site', site]]));
    expect(container.textContent).toContain(es['scene.noTerrain']);
  });
});

describe('createInput', () => {
  const press = (target, type, code) => target.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));

  test('W + Shift = forward with boost; releasing W stops it', () => {
    const input = createInput(window);
    press(window, 'keydown', 'KeyW');
    press(window, 'keydown', 'ShiftLeft');
    expect(input.read()).toEqual({ forward: 1, turn: 0, boost: true });
    press(window, 'keyup', 'KeyW');
    expect(input.read()).toEqual({ forward: 0, turn: 0, boost: true });
    press(window, 'keyup', 'ShiftLeft');
    input.dispose();
  });

  test('arrows and WASD combine: back + right', () => {
    const input = createInput(window);
    press(window, 'keydown', 'ArrowDown');
    press(window, 'keydown', 'KeyD');
    expect(input.read()).toEqual({ forward: -1, turn: 1, boost: false });
    input.dispose();
  });

  test('typing in a form field does not drive the robot', () => {
    const input = createInput(window);
    const field = document.createElement('input');
    document.body.append(field);
    press(field, 'keydown', 'KeyW');
    expect(input.read().forward).toBe(0);
    field.remove();
    input.dispose();
  });

  test('dispose removes the listeners', () => {
    const input = createInput(window);
    input.dispose();
    press(window, 'keydown', 'KeyW');
    expect(input.read().forward).toBe(0);
  });
});

describe('createRobotMesh', () => {
  test('has six wheels', () => {
    expect(createRobotMesh().children.filter((c) => c.name === 'wheel')).toHaveLength(6);
  });
});
