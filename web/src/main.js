// Fonts are bundled with the app (no request to Google): Latin subset, only the weights used
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import { startTerrainPreload } from './data/preload.js';
import { ensureTerrain, loadSite } from './data/siteData.js';
import { setLocale, t } from './i18n.js';
import { litStart } from './metrics/overview.js';
import { loadPrefs, startPrefsSync } from './prefs.js';
import { parseUrlState, startUrlSync } from './urlState.js';
import { DEFAULT_THRESHOLDS } from './metrics/scenario.js';
import { clampTime } from './panel/controls.js';
import './panel/panel.css';
import { renderTimeline } from './panel/timeline.js';
import { mountScene } from './scene/view3d.js';
import { createAmbientMusic } from './scene/ambientMusic.js';
import { createAudioCue } from './scene/audioCue.js';
import { createRoverHum } from './scene/roverHum.js';
import './scene/scene.css';
import { createStore } from './state.js';
import { mountInterface } from './ui/interface.js';
import './ui/ui.css';

const SITES_URL = `${import.meta.env.BASE_URL}sites`;
const LANG_KEY = 'inside-moon-153.lang';

/** The language to start in: ?lang=es|en (the game links back with it), then the one saved by the last visit, then Spanish. */
function startingLocale() {
  const wanted = new URLSearchParams(window.location.search).get('lang');
  try {
    if (wanted === 'es' || wanted === 'en') return wanted;
    const saved = window.localStorage.getItem(LANG_KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    /* no storage: Spanish */
  }
  return wanted === 'en' ? 'en' : 'es';
}
const DAY_MS = 24 * 3_600_000;
const OPENING_YEAR = 2027;
const OPENING_STAY_MS = 7 * DAY_MS;

function setSplashText(key) {
  const node = document.getElementById('splash-text');
  if (node) node.textContent = t(key);
}

function hideSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.classList.add('splash-out');
  setTimeout(() => splash.remove(), 400);
}

/** First date shown: the sunniest week of the opening year, so the terrain is lit on arrival (1 Jan if none fits). */
function openingTime(site) {
  const fallback = Date.UTC(OPENING_YEAR, 0, 1);
  const lit = litStart(site, {
    stayMs: OPENING_STAY_MS,
    fromMs: fallback,
    toMs: Date.UTC(OPENING_YEAR + 1, 0, 1),
  });
  return clampTime(site.eph, lit ?? fallback).timeMs;
}

async function main() {
  const root = document.getElementById('app');
  setSplashText('app.loading');
  try {
    const response = await fetch(`${SITES_URL}/index.json`);
    if (!response.ok) throw new Error(`${SITES_URL}/index.json (HTTP ${response.status})`);
    const siteList = await response.json();
    // Light data (ephemeris + horizon, ~0.7 MB each) for every site, so the panel and the
    // analysis can compare them; the 2 MB terrain of a site is fetched when it is first shown.
    const loaded = await Promise.all(siteList.map((entry) => loadSite(SITES_URL, entry.id, { terrain: false })));
    const sites = new Map(siteList.map((entry, i) => [entry.id, loaded[i]]));

    // ?site=<id> (sent by the start screen, public/inicio/) picks the site shown first, and ?t=<UTC date> the
    // moment: both come from a shared link (see urlState.js).
    const wanted = parseUrlState(window.location.search, siteList.map((entry) => entry.id));
    const first = wanted.siteId ?? siteList[0].id;
    setSplashText('app.loadingTerrain');
    await ensureTerrain(sites.get(first));
    const timeMs = wanted.timeMs === null ? openingTime(sites.get(first)) : clampTime(sites.get(first).eph, wanted.timeMs).timeMs;
    const locale = startingLocale();
    setLocale(locale);
    const prefs = loadPrefs(); // the choices of the last visit (view, volume, thresholds...)
    const store = createStore({
      scenarios: { A: { siteId: first, timeMs }, B: null },
      windowMs: 7 * DAY_MS,
      thresholds: { ...DEFAULT_THRESHOLDS },
      playing: false,
      soundEnabled: false,
      shadowLift: false,
      lrocTexture: true,
      viewMode: 'follow',
      quality: 'auto',
      panelOpen: false,
      locale,
      ...prefs,
    });
    startPrefsSync(store);
    startUrlSync(store);
    const audioCue = createAudioCue({ createMusic: createAmbientMusic, createHum: createRoverHum });
    if (prefs.volume !== undefined) audioCue.setVolume?.(prefs.volume);
    const scene = mountScene(document.getElementById('scene'), store, sites, audioCue);
    if (import.meta.env.DEV) window.__navigator = scene.debug;
    const ui = mountInterface(root, store, siteList, sites, { renderTimeline, audioCue });
    ui.tutorial.openIfFirstVisit();
    startTerrainPreload(sites, first); // the other sites' terrain, fetched while the browser is idle
  } catch (error) {
    root.textContent = t('app.loadError', { message: error.message });
  } finally {
    hideSplash();
  }
}

const STARTED_KEY = 'inside-moon-153.started';

/** First visit of the session without ?site= or ?lang=: show the Moon start screen (public/inicio/) first. */
function needsStartScreen() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('site') || params.has('lang')) {
      window.sessionStorage.setItem(STARTED_KEY, '1');
      return false;
    }
    return !window.sessionStorage.getItem(STARTED_KEY);
  } catch {
    return false;
  }
}

if (needsStartScreen()) {
  window.location.replace(`${import.meta.env.BASE_URL}inicio/index.html`);
} else {
  main();
}
