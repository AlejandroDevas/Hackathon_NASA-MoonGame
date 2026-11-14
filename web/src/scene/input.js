const FORWARD = ['KeyW', 'ArrowUp'];
const BACKWARD = ['KeyS', 'ArrowDown'];
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const BOOST = ['ShiftLeft', 'ShiftRight'];
const CONTROL_KEYS = new Set([...FORWARD, ...BACKWARD, ...LEFT, ...RIGHT]);

function isFormField(target) {
  return target instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName);
}

/**
 * Keyboard state for driving the robot. Keys typed into form fields are ignored.
 * @param {EventTarget} target usually `window`
 */
export function createInput(target) {
  const down = new Set();
  const onKeyDown = (event) => {
    if (isFormField(event.target)) return;
    // Ctrl/Meta/Alt + key is a browser shortcut (Ctrl+S, Ctrl+A, Ctrl+D...), not driving
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    down.add(event.code);
    if (CONTROL_KEYS.has(event.code)) event.preventDefault(); // arrows must not scroll the page
  };
  const onKeyUp = (event) => down.delete(event.code);
  const onBlur = () => down.clear();

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  const any = (codes) => codes.some((code) => down.has(code));
  return {
    read: () => ({
      forward: (any(FORWARD) ? 1 : 0) - (any(BACKWARD) ? 1 : 0),
      turn: (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0),
      boost: any(BOOST),
    }),
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
      down.clear();
    },
  };
}
