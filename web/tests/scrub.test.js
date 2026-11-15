import { describe, expect, test } from 'vitest';
import { createScrubber, scrubKeyDeltaMs, timeFromPointer } from '../src/panel/scrub.js';

const HOUR = 3_600_000;

describe('timeFromPointer', () => {
  const rect = { left: 100, width: 400 };

  test('maps the plot area linearly onto the time range', () => {
    expect(timeFromPointer(100, rect, 0, 1000)).toBe(0);
    expect(timeFromPointer(500, rect, 0, 1000)).toBe(1000);
    expect(timeFromPointer(300, rect, 0, 1000)).toBe(500);
  });

  test('clamps a pointer outside the plot to the range ends', () => {
    expect(timeFromPointer(50, rect, 0, 1000)).toBe(0);
    expect(timeFromPointer(900, rect, 0, 1000)).toBe(1000);
  });

  test('a zero-width rectangle gives the start of the range', () => {
    expect(timeFromPointer(300, { left: 100, width: 0 }, 40, 1000)).toBe(40);
  });
});

describe('scrubKeyDeltaMs', () => {
  test('arrows step an hour (six with Shift), Page keys a day, other keys nothing', () => {
    expect(scrubKeyDeltaMs('ArrowRight', false)).toBe(HOUR);
    expect(scrubKeyDeltaMs('ArrowLeft', false)).toBe(-HOUR);
    expect(scrubKeyDeltaMs('ArrowLeft', true)).toBe(-6 * HOUR);
    expect(scrubKeyDeltaMs('PageUp', false)).toBe(24 * HOUR);
    expect(scrubKeyDeltaMs('PageDown', false)).toBe(-24 * HOUR);
    expect(scrubKeyDeltaMs('a', false)).toBeNull();
  });
});

describe('createScrubber', () => {
  function setup() {
    const element = document.createElement('div');
    element.getBoundingClientRect = () => ({ left: 100, width: 400 });
    const calls = [];
    let queued = null;
    const raf = (cb) => {
      queued = cb;
      return 1;
    };
    const caf = () => {
      queued = null;
    };
    const flush = () => {
      const cb = queued;
      queued = null;
      cb?.();
    };
    const scrubber = createScrubber({
      element,
      getRange: () => ({ fromMs: 0, toMs: 1000 }),
      getTime: () => 400,
      onScrub: (ms) => calls.push(ms),
      raf,
      caf,
    });
    const fire = (type, clientX) => element.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true, cancelable: true }));
    return { element, calls, flush, scrubber, fire, pending: () => queued };
  }

  test('pointerdown scrubs to the pointer position, once per frame', () => {
    const { calls, flush, fire } = setup();
    fire('pointerdown', 300);
    expect(calls).toEqual([]); // nothing until the frame
    flush();
    expect(calls).toEqual([500]);
  });

  test('several moves within one frame produce one call with the last position', () => {
    const { calls, flush, fire } = setup();
    fire('pointerdown', 100);
    flush();
    fire('pointermove', 200);
    fire('pointermove', 300);
    fire('pointermove', 400);
    flush();
    expect(calls).toEqual([0, 750]);
  });

  test('moves without a drag, and after pointerup, do nothing', () => {
    const { calls, flush, fire } = setup();
    fire('pointermove', 300);
    flush();
    fire('pointerdown', 300);
    flush();
    fire('pointerup', 300);
    fire('pointermove', 400);
    flush();
    expect(calls).toEqual([500]);
  });

  test('the element becomes a keyboard-focusable slider that does not scroll on touch', () => {
    const { element } = setup();
    expect(element.getAttribute('role')).toBe('slider');
    expect(element.tabIndex).toBe(0);
    expect(element.style.touchAction).toBe('none');
    expect(element.getAttribute('aria-label')).toBeTruthy();
  });

  test('arrow keys move the time immediately and do not scroll the page', () => {
    const { element, calls } = setup();
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    expect(calls).toEqual([400 + HOUR]);
    expect(event.defaultPrevented).toBe(true);
    const other = new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true });
    element.dispatchEvent(other);
    expect(calls).toHaveLength(1);
    expect(other.defaultPrevented).toBe(false);
  });

  test('dispose removes the listeners and cancels a pending frame', () => {
    const { calls, flush, fire, scrubber, pending } = setup();
    fire('pointerdown', 300);
    scrubber.dispose();
    expect(pending()).toBeNull();
    flush();
    fire('pointerdown', 300);
    flush();
    expect(calls).toEqual([]);
  });
});
