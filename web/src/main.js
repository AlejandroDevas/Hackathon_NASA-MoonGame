// Fonts are bundled with the app (no request to Google): Latin subset, only the weights used
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import { ensureTerrain, loadSite } from './data/siteData.js';
import { t } from './i18n.js';
import { litStart } from './metrics/overview.js';
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

    const first = siteList[0].id;
    setSplashText('app.loadingTerrain');
    await ensureTerrain(sites.get(first));
    const timeMs = openingTime(sites.get(first));
    const store = createStore({
      scenarios: { A: { siteId: first, timeMs }, B: null },
      windowMs: 7 * DAY_MS,
      thresholds: { ...DEFAULT_THRESHOLDS },
      playing: false,
      soundEnabled: false,
      shadowLift: false,
      lrocTexture: true,
      viewMode: 'follow',
      panelOpen: false,
      locale: 'es',
    });
    const audioCue = createAudioCue({ createMusic: createAmbientMusic, createHum: createRoverHum });
    const scene = mountScene(document.getElementById('scene'), store, sites, audioCue);
    if (import.meta.env.DEV) window.__navigator = scene.debug;
    const ui = mountInterface(root, store, siteList, sites, { renderTimeline, audioCue });
    ui.tutorial.openIfFirstVisit();
  } catch (error) {
    root.textContent = t('app.loadError', { message: error.message });
  } finally {
    hideSplash();
  }
}

main();
