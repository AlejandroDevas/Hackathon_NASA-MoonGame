import { createAnalysis } from '../panel/analysis.js';
import { mountPanel } from '../panel/panel.js';
import { createPlayback } from './playback.js';
import { createPlayBar } from './playbar.js';
import { createTopBar } from './topbar.js';

/**
 * Mounts the whole interface around the 3D scene: the top bar (name, language, view toggles and the
 * menu), the player bar at the bottom, and the planner drawer (`root`), which starts closed.
 * @param {HTMLElement} root element that receives the planner drawer
 * @param {{get(): object, set(p: object): void, subscribe(fn: Function): () => void}} store
 * @param {Array<{id: string, name: string}>} siteList
 * @param {Map<string, object>} sites
 * @param {{renderTimeline: Function, audioCue?: object}} deps
 */
export function mountInterface(root, store, siteList, sites, { renderTimeline, audioCue }) {
  const playback = createPlayback(store, sites);
  const analysis = createAnalysis(store, siteList, sites);
  const top = createTopBar(store, { analysis, sites, siteList, audioCue });
  const bottom = createPlayBar(store, sites, playback);
  document.body.append(top.el, bottom.el);

  // the interface sounds of the planner (a click on any button or choice) also cover the two bars
  for (const bar of [top.el, bottom.el]) {
    bar.addEventListener('click', (event) => {
      if (event.target.closest?.('button')) audioCue?.play?.('click');
    });
    bar.addEventListener('change', (event) => {
      if (event.target.closest?.('select')) audioCue?.play?.('click');
    });
  }

  mountPanel(root, store, siteList, sites, { renderTimeline, audioCue, playback });

  const refresh = (state) => {
    top.refresh(state);
    bottom.refresh(state);
  };
  store.subscribe(refresh);
  refresh(store.get());

  // Escape closes the planner, unless something on top of it (a menu, the Analysis window) takes the key first
  const onKey = (event) => {
    if (event.key === 'Escape' && store.get().panelOpen && !analysis.isOpen() && root.contains(document.activeElement)) {
      store.set({ panelOpen: false });
      top.menu.button.focus();
    }
  };
  document.addEventListener('keydown', onKey);

  return {
    playback,
    analysis,
    dispose() {
      document.removeEventListener('keydown', onKey);
      analysis.dispose();
      top.el.remove();
      bottom.el.remove();
    },
  };
}
