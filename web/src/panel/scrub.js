import { t } from '../i18n.js';

const HOUR_MS = 3_600_000;

/**
 * Time under the pointer: the plot area `rect` (left, width) is mapped linearly onto
 * [fromMs, toMs] and the pointer is clamped to it. A zero-width rectangle gives `fromMs`.
 */
export function timeFromPointer(clientX, rect, fromMs, toMs) {
  if (!(rect.width > 0)) return fromMs;
  const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  return fromMs + ratio * (toMs - fromMs);
}

/** Time step for a key on the chart: arrows 1 h (Shift: 6 h), Page keys 1 day, anything else null. */
export function scrubKeyDeltaMs(key, shiftKey) {
  switch (key) {
    case 'ArrowRight':
      return (shiftKey ? 6 : 1) * HOUR_MS;
    case 'ArrowLeft':
      return -(shiftKey ? 6 : 1) * HOUR_MS;
    case 'PageUp':
      return 24 * HOUR_MS;
    case 'PageDown':
      return -24 * HOUR_MS;
    default:
      return null;
  }
}

/**
 * Make `element` a draggable, keyboard-operable time slider. `onScrub(ms)` is called
 * at most once per animation frame while dragging (with the latest position) and
 * immediately for keys.
 * @param {{element: HTMLElement, getRange: () => {fromMs: number, toMs: number},
 *   getTime: () => number, onScrub: (ms: number) => void, raf?: Function, caf?: Function}} options
 * @returns {{dispose(): void}}
 */
export function createScrubber({
  element,
  getRange,
  getTime,
  onScrub,
  raf = (callback) => requestAnimationFrame(callback),
  caf = (handle) => cancelAnimationFrame(handle),
}) {
  element.tabIndex = 0;
  element.setAttribute('role', 'slider');
  element.setAttribute('aria-label', t('chart.scrub'));
  element.style.touchAction = 'none'; // a touch drag scrubs instead of scrolling the page

  let dragging = false;
  let pendingMs = null;
  let handle = null;

  function schedule(ms) {
    pendingMs = ms;
    if (handle !== null) return;
    handle = raf(() => {
      handle = null;
      const value = pendingMs;
      pendingMs = null;
      if (value !== null) onScrub(value);
    });
  }

  const timeAt = (event) => {
    const { fromMs, toMs } = getRange();
    return timeFromPointer(event.clientX, element.getBoundingClientRect(), fromMs, toMs);
  };

  const onDown = (event) => {
    dragging = true;
    try {
      element.setPointerCapture?.(event.pointerId);
    } catch {
      /* no capture available: the drag still works while the pointer stays over the chart */
    }
    schedule(timeAt(event));
  };
  const onMove = (event) => {
    if (dragging) schedule(timeAt(event));
  };
  const onUp = (event) => {
    dragging = false;
    try {
      element.releasePointerCapture?.(event.pointerId);
    } catch {
      /* nothing was captured */
    }
  };
  const onKey = (event) => {
    const delta = scrubKeyDeltaMs(event.key, event.shiftKey);
    if (delta === null) return;
    event.preventDefault(); // arrows must not scroll the page
    onScrub(getTime() + delta);
  };

  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', onUp);
  element.addEventListener('pointercancel', onUp);
  element.addEventListener('keydown', onKey);

  return {
    dispose() {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onUp);
      element.removeEventListener('keydown', onKey);
      if (handle !== null) caf(handle);
      handle = null;
      pendingMs = null;
      dragging = false;
    },
  };
}
