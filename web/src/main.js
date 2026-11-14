import { loadSite } from './data/siteData.js';
import { t } from './i18n.js';
import { DEFAULT_THRESHOLDS } from './metrics/scenario.js';
import { clampTime } from './panel/controls.js';
import { mountPanel } from './panel/panel.js';
import './panel/panel.css';
import { renderTimeline } from './panel/timeline.js';
import { mountScene } from './scene/view3d.js';
import { createAudioCue } from './scene/audioCue.js';
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
    const loaded = await Promise.all(siteList.map((entry) => loadSite(SITES_URL, entry.id)));
    const sites = new Map(siteList.map((entry, i) => [entry.id, loaded[i]]));

    const first = siteList[0].id;
    const { timeMs } = clampTime(sites.get(first).eph, Date.UTC(2027, 0, 1));
    const store = createStore({
      scenarios: { A: { siteId: first, timeMs }, B: null },
      windowMs: 7 * DAY_MS,
      thresholds: { ...DEFAULT_THRESHOLDS },
      playing: false,
      soundEnabled: false,
      locale: 'es',
    });
    const audioCue = createAudioCue();
    const scene = mountScene(document.getElementById('scene'), store, sites, audioCue);
    if (import.meta.env.DEV) window.__navigator = scene.debug;
    mountPanel(root, store, siteList, sites, { renderTimeline, audioCue });
  } catch (error) {
    root.textContent = t('app.loadError', { message: error.message });
  }
}

main();
