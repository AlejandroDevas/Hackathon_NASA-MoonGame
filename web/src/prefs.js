import { DEFAULT_THRESHOLDS } from './metrics/scenario.js';
import { WINDOW_MS } from './panel/controls.js';
import { QUALITY_MODES } from './scene/quality.js';

export const PREFS_KEY = 'inside-moon-153.prefs';

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const inRange = (value, min, max) => isNumber(value) && value >= min && value <= max;

/**
 * The saved choices that make sense, and only those: anything of the wrong type or out of range is
 * dropped (the file is in the visitor's browser, so it can be old, edited or from another version).
 * @param {unknown} raw
 * @returns {object} a partial state
 */
export function sanitizePrefs(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  if (typeof raw.shadowLift === 'boolean') out.shadowLift = raw.shadowLift;
  if (typeof raw.lrocTexture === 'boolean') out.lrocTexture = raw.lrocTexture;
  if (raw.viewMode === 'follow' || raw.viewMode === 'free') out.viewMode = raw.viewMode;
  if (inRange(raw.volume, 0, 1)) out.volume = raw.volume;
  if (QUALITY_MODES.includes(raw.quality)) out.quality = raw.quality;
  if (WINDOW_MS.includes(raw.windowMs)) out.windowMs = raw.windowMs;
  const th = raw.thresholds;
  if (th && typeof th === 'object') {
    const next = { ...DEFAULT_THRESHOLDS };
    if (inRange(th.minSunElDeg, -90, 90)) next.minSunElDeg = th.minSunElDeg;
    if (inRange(th.maxDarkH, 0, 100_000)) next.maxDarkH = th.maxDarkH;
    if (inRange(th.maxEarthGapH, 0, 100_000)) next.maxEarthGapH = th.maxEarthGapH;
    out.thresholds = next;
  }
  return out;
}

/** What gets saved from the state. */
function pick(state) {
  const { shadowLift, lrocTexture, viewMode, volume, quality, windowMs, thresholds } = state;
  return { shadowLift, lrocTexture, viewMode, volume, quality, windowMs, thresholds };
}

/** The choices saved by the last visit ({} without storage or with a damaged file). */
export function loadPrefs(storage = globalThis.localStorage) {
  try {
    return sanitizePrefs(JSON.parse(storage.getItem(PREFS_KEY)));
  } catch {
    return {};
  }
}

/**
 * Save the choices whenever one changes. Sound on/off is left out on purpose: browsers only allow
 * audio after a click, so it always starts off.
 * @returns {() => void} stop
 */
export function startPrefsSync(store, storage = globalThis.localStorage) {
  let saved = JSON.stringify(pick(store.get()));
  return store.subscribe((state) => {
    const next = JSON.stringify(pick(state));
    if (next === saved) return;
    saved = next;
    try {
      storage.setItem(PREFS_KEY, next);
    } catch {
      /* no storage, or it is full: the choices last for this visit */
    }
  });
}
