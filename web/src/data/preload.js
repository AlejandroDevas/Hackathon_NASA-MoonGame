import { ensureTerrain } from './siteData.js';

/** Connections slower than this are left alone: the terrains are only fetched on demand there. */
const SLOW_TYPES = new Set(['slow-2g', '2g', '3g']);

/**
 * Whether it is polite to fetch data nobody asked for yet: not when the visitor asked the browser to save data,
 * and not on a slow connection.
 * @param {{saveData?: boolean, effectiveType?: string}|undefined} connection `navigator.connection`, when there is one
 */
export function mayPreload(connection) {
  return !(connection?.saveData || SLOW_TYPES.has(connection?.effectiveType));
}

function defaultSchedule(callback) {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(callback, { timeout: 10_000 });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(callback, 2_000);
  return () => clearTimeout(handle);
}

/**
 * Fetch the terrain of the other sites while the browser is idle, one at a time and after a pause, so that
 * choosing one later is instant. Whatever the visitor does meanwhile comes first (a site chosen by hand shares
 * the same request). Skipped on a slow or data-saving connection.
 * @param {Map<string, object>} sites
 * @param {string} firstId the site already on screen
 * @param {{ensure?: Function, schedule?: (cb: () => void) => () => void, connection?: object, delayMs?: number}} [options]
 * @returns {() => void} stops it
 */
export function startTerrainPreload(sites, firstId, {
  ensure = ensureTerrain,
  schedule = defaultSchedule,
  connection = globalThis.navigator?.connection,
  delayMs = 4_000,
} = {}) {
  if (!mayPreload(connection)) return () => {};
  const queue = [...sites.entries()].filter(([id, site]) => id !== firstId && site.info?.terrain && !site.terrain).map(([, site]) => site);
  let cancelled = false;
  let cancelStep = () => {};
  let timer = null;

  function next() {
    if (cancelled) return;
    const site = queue.shift();
    if (!site) return;
    cancelStep = schedule(() => {
      Promise.resolve(ensure(site))
        .catch(() => {}) // a failure here is not the visitor's business: choosing that site tries again
        .then(next);
    });
  }
  timer = setTimeout(next, delayMs);
  return () => {
    cancelled = true;
    clearTimeout(timer);
    cancelStep();
  };
}
