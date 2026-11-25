const TIME_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?Z?$/;

/** "2027-09-18T14:00": the UTC minute, short enough to read and to type. */
export function formatUrlTime(timeMs) {
  return new Date(timeMs).toISOString().slice(0, 16);
}

/**
 * What a shared link asks for: ?site=<id> (only if it is a known site) and ?t=<UTC date, with an
 * optional time>. Anything missing or malformed comes back as null, so the caller keeps its default.
 * @param {string} search `window.location.search`
 * @param {string[]} siteIds the sites that exist
 * @returns {{siteId: string|null, timeMs: number|null}}
 */
export function parseUrlState(search, siteIds) {
  const params = new URLSearchParams(search);
  const site = params.get('site');
  const text = params.get('t');
  let timeMs = null;
  if (text && TIME_PATTERN.test(text)) {
    const parsed = Date.parse(text.endsWith('Z') ? text : `${text}Z`);
    if (Number.isFinite(parsed)) timeMs = parsed;
  }
  return { siteId: site && siteIds.includes(site) ? site : null, timeMs };
}

/** The query string for the current scenario; any other parameter already in the URL is kept. */
export function buildUrlSearch(currentSearch, { siteId, timeMs, locale }) {
  const params = new URLSearchParams(currentSearch);
  params.set('site', siteId);
  params.set('t', formatUrlTime(timeMs));
  params.set('lang', locale);
  return `?${params.toString()}`;
}

/**
 * Keep the address bar in step with scenario A (site, date and language), so the page can be
 * shared or reloaded as it is. Updates at most once per `intervalMs` (the animation changes the
 * time all the time) and never adds history entries.
 * @param {{get(): object, subscribe(fn: Function): () => void}} store
 * @param {{win?: Window, intervalMs?: number}} [options]
 * @returns {() => void} stop
 */
export function startUrlSync(store, { win = window, intervalMs = 750 } = {}) {
  let timer = null;
  let written = null;

  function write() {
    timer = null;
    const { scenarios, locale } = store.get();
    const search = buildUrlSearch(win.location.search, { siteId: scenarios.A.siteId, timeMs: scenarios.A.timeMs, locale });
    if (search === written) return;
    written = search;
    try {
      win.history.replaceState(win.history.state, '', `${win.location.pathname}${search}${win.location.hash}`);
    } catch {
      /* some embedded browsers refuse: the link just stays as it was */
    }
  }

  const unsubscribe = store.subscribe(() => {
    if (timer === null) timer = setTimeout(write, intervalMs);
  });
  return () => {
    unsubscribe();
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
}
