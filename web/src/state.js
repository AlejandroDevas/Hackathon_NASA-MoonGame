/**
 * Minimal observable store.
 * @template T
 * @param {T} initial
 */
export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    /** Shallow-merge `partial` into the state and notify subscribers. */
    set(partial) {
      state = { ...state, ...partial };
      for (const listener of [...listeners]) listener(state);
    },
    /** @returns {() => void} unsubscribe */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
