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
import { DEFAULT_THRESHOLDS } from './metrics/scenario.js';
import { clampTime } from './panel/controls.js';
import { mountPanel } from './panel/panel.js';
import './panel/panel.css';
import { renderTimeline } from './panel/timeline.js';
import { mountScene } from './scene/view3d.js';
import { createAmbientMusic } from './scene/ambientMusic.js';
import { createAudioCue } from './scene/audioCue.js';
import { createRoverHum } from './scene/roverHum.js';
import './scene/scene.css';
import { createStore } from './state.js';

const SITES_URL = `${import.meta.env.BASE_URL}sites`;
const DAY_MS = 24 * 3_600_000;

async function main() {
  const root = document.getElementById('app');
  try {
    const response = await fetch(`${SITES_URL}/index.json`);
    if (!response.ok) throw new Error(`${SITES_URL}/index.json (HTTP ${response.status})`);
    const siteList = await response.json();
    // Light data (ephemeris + horizon, ~0.7 MB each) for every site, so the panel and the
    // analysis can compare them; the 2 MB terrain of a site is fetched when it is first shown.
    const loaded = await Promise.all(siteList.map((entry) => loadSite(SITES_URL, entry.id, { terrain: false })));
    const sites = new Map(siteList.map((entry, i) => [entry.id, loaded[i]]));

    const first = siteList[0].id;
    await ensureTerrain(sites.get(first));
    const { timeMs } = clampTime(sites.get(first).eph, Date.UTC(2027, 0, 1));
    const store = createStore({
      scenarios: { A: { siteId: first, timeMs }, B: null },
      windowMs: 7 * DAY_MS,
      thresholds: { ...DEFAULT_THRESHOLDS },
      playing: false,
      soundEnabled: false,
      shadowLift: false,
      lrocTexture: true,
      viewMode: 'follow',
      locale: 'es',
    });
    const audioCue = createAudioCue({ createMusic: createAmbientMusic, createHum: createRoverHum });
    const scene = mountScene(document.getElementById('scene'), store, sites, audioCue);
    if (import.meta.env.DEV) window.__navigator = scene.debug;
    mountPanel(root, store, siteList, sites, { renderTimeline, audioCue });
  } catch (error) {
    root.textContent = t('app.loadError', { message: error.message });
  }
}

main();
