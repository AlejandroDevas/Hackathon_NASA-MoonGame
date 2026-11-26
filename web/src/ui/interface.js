import { createLazyAnalysis } from '../panel/analysisLazy.js';
import { mountPanel } from '../panel/panel.js';
import { SKIPS, createPlayback } from './playback.js';
import { createPlayBar } from './playbar.js';
import { createTopBar } from './topbar.js';
import { createTutorial } from './tutorial.js';

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
  const analysis = createLazyAnalysis(store, siteList, sites);
  const tutorial = createTutorial();
  const top = createTopBar(store, { analysis, sites, siteList, audioCue, tutorial });
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

  // player shortcuts: space plays or pauses, [ and ] change the speed, , and . step an hour. They never fire while the
  // visitor is typing or on a control that uses those keys, nor while the tutorial or the Analysis window is open.
  const onShortcut = (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
    if (event.target instanceof Element && event.target.closest('input, select, textarea, button, a, [role^="menuitem"], [contenteditable]')) return;
    if (tutorial.isOpen() || analysis.isOpen()) return;
    const action = {
      Space: () => playback.toggle(),
      BracketRight: () => playback.faster(),
      BracketLeft: () => playback.slower(),
      Period: () => playback.shiftBy(SKIPS.hour),
      Comma: () => playback.shiftBy(-SKIPS.hour),
    }[event.code];
    if (!action) return;
    event.preventDefault();
    action();
    bottom.refresh(store.get()); // a speed change on a paused animation changes no state
  };
  document.addEventListener('keydown', onShortcut);

  return {
    playback,
    analysis,
    tutorial,
    dispose() {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keydown', onShortcut);
      tutorial.dispose();
      analysis.dispose();
      top.el.remove();
      bottom.el.remove();
    },
  };
}
