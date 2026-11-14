/**
 * Advance a simulated time, stopping at the end of the data.
 * @returns {{timeMs: number, ended: boolean}}
 */
export function advanceTime(eph, timeMs, dtSimMs) {
  const last = eph.startMs + (eph.count - 1) * eph.stepMs;
  const next = timeMs + dtSimMs;
  return next >= last ? { timeMs: last, ended: true } : { timeMs: next, ended: false };
}

/**
 * Animation loop: advances scenarios A (and B, if any) together.
 * It stops by itself at the end of the data or when either site changes.
 * @param {{get(): object, set(p: object): void, subscribe(fn: Function): () => void}} store
 * @param {Map<string, object>} sites loaded sites by id
 * @param {number} speedMsPerSec simulated milliseconds per real second
 */
export function createPlayer(store, sites, speedMsPerSec, { raf, caf } = {}) {
  const request = raf ?? ((cb) => requestAnimationFrame(cb));
  const cancel = caf ?? ((id) => cancelAnimationFrame(id));
  let handle = null;
  let last = null;
  let unsubscribe = null;

  const siteIds = (state) => `${state.scenarios.A.siteId}|${state.scenarios.B?.siteId ?? ''}`;

  function stop() {
    if (handle !== null) {
      cancel(handle);
      handle = null;
    }
    unsubscribe?.();
    unsubscribe = null;
    last = null;
    if (store.get().playing) store.set({ playing: false });
  }

  function frame(timestamp) {
    handle = null;
    if (last === null) last = timestamp;
    const dtSimMs = ((timestamp - last) / 1000) * speedMsPerSec;
    last = timestamp;

    const { scenarios } = store.get();
    const next = {};
    let allEnded = true;
    for (const slot of ['A', 'B']) {
      const scenario = scenarios[slot];
      if (!scenario) {
        next[slot] = null;
        continue;
      }
      const result = advanceTime(sites.get(scenario.siteId).eph, scenario.timeMs, dtSimMs);
      next[slot] = { ...scenario, timeMs: result.timeMs };
      if (!result.ended) allEnded = false;
    }
    store.set({ scenarios: next });
    if (allEnded) stop();
    else handle = request(frame);
  }

  function start() {
    if (handle !== null) return;
    store.set({ playing: true });
    const ids = siteIds(store.get());
    unsubscribe = store.subscribe((state) => {
      if (siteIds(state) !== ids) stop();
    });
    handle = request(frame);
  }

  return { start, stop };
}
