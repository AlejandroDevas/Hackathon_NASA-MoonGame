import { t } from '../i18n.js';
import { evaluateScenario, viability } from '../metrics/scenario.js';
import { TEAM } from '../team.js';
import { renderDiff } from './compare.js';
import { clampTime, renderControls } from './controls.js';
import { renderScenarioCard } from './scenarioCard.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Mount the planner into `root` (a drawer on the right, closed until the menu opens it) and keep it in
 * sync with `store`. The tools of the top bar and the player live in `../ui/`.
 * @param {HTMLElement} root
 * @param {object} store state store (see state.js)
 * @param {Array<{id: string, name: string}>} siteList
 * @param {Map<string, object>} sites loaded sites by id
 * @param {{renderTimeline: Function, audioCue?: object, playback?: {pause(): void}}} deps chart renderer, injected so the panel does not depend on uPlot
 */
export function mountPanel(root, store, siteList, sites, { renderTimeline, audioCue, playback }) {
  let structureKey = null;
  let views = {};

  // One delegated listener: the root survives rebuilds, so it also covers re-created controls.
  root.addEventListener('click', (event) => {
    if (event.target.closest?.('button')) audioCue?.play?.('click');
  });
  root.addEventListener('change', (event) => {
    if (event.target.closest?.('select')) audioCue?.play?.('click');
  });

  function createView(slot, section) {
    const controlsEl = el('div');
    const cardEl = el('div');
    const chartEl = el('div', 'timeline');
    const diffEl = slot === 'B' ? el('div') : null;
    section.append(el('h3', 'scenario-name', t(`scenario.${slot}`)), controlsEl, cardEl, chartEl);
    if (diffEl) section.append(diffEl);
    renderControls(controlsEl, store, siteList, sites, slot);

    let timeline = null;
    let plotted = null;

    function syncInputs(scenario) {
      const select = controlsEl.querySelector(`[data-testid="site-${slot}"]`);
      const time = controlsEl.querySelector(`[data-testid="time-${slot}"]`);
      if (select && select.value !== scenario.siteId) select.value = scenario.siteId;
      const value = new Date(scenario.timeMs).toISOString().slice(0, 16);
      if (time && time.value !== value && document.activeElement !== time) time.value = value;
    }

    let lastLevel = null; // null until the first render, so opening the page is silent

    return {
      /** @returns the scenario's metrics, or null if the time had to be clamped first */
      update(state, metricsA) {
        const scenario = state.scenarios[slot];
        const site = sites.get(scenario.siteId);
        const { timeMs, clamped } = clampTime(site.eph, scenario.timeMs);
        if (clamped) {
          store.set({ scenarios: { ...state.scenarios, [slot]: { ...scenario, timeMs } } });
          return null;
        }
        syncInputs(scenario);

        const metrics = evaluateScenario(site, timeMs, state.windowMs);
        const verdict = viability(metrics, state.thresholds);
        renderScenarioCard(cardEl, metrics, verdict, site.info);
        // Only scenario A speaks, and not while the animation runs (the level can flip often then).
        if (slot === 'A') {
          if (lastLevel !== null && verdict.level !== lastLevel && !state.playing) audioCue?.play?.(`verdict-${verdict.level}`);
          lastLevel = verdict.level;
          audioCue?.setSunElevation?.(metrics.sunElDeg); // the music follows the light
        }
        if (diffEl && metricsA) renderDiff(diffEl, metricsA, metrics);

        const stale =
          !plotted ||
          plotted.siteId !== scenario.siteId ||
          plotted.windowMs !== state.windowMs ||
          timeMs < plotted.fromMs ||
          timeMs > plotted.fromMs + state.windowMs;
        if (stale) {
          timeline?.destroy();
          chartEl.replaceChildren();
          plotted = { siteId: scenario.siteId, windowMs: state.windowMs, fromMs: timeMs };
          timeline = renderTimeline(chartEl, site, timeMs, timeMs + state.windowMs, timeMs, {
            getTime: () => store.get().scenarios[slot]?.timeMs ?? timeMs,
            onScrub: (ms) => {
              playback?.pause(); // dragging takes over from the animation
              const { scenarios } = store.get();
              const scenario = scenarios[slot];
              if (!scenario) return;
              const clamped = clampTime(sites.get(scenario.siteId).eph, ms).timeMs;
              store.set({ scenarios: { ...scenarios, [slot]: { ...scenario, timeMs: clamped } } });
            },
          });
        } else {
          timeline.setCursor(timeMs);
        }
        return metrics;
      },
      destroy() {
        timeline?.destroy();
      },
    };
  }

  /** The heading of the drawer and its close button. */
  function buildDrawerHeader() {
    const header = el('header', 'drawer-header');
    const title = el('h2', 'drawer-title', t('ui.panelTitle'));
    const close = el('button', 'drawer-close');
    close.type = 'button';
    close.dataset.testid = 'panel-close';
    close.setAttribute('aria-label', t('ui.panelClose'));
    close.title = t('ui.panelClose');
    close.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    close.addEventListener('click', () => store.set({ panelOpen: false }));
    header.append(title, close);
    return header;
  }

  function rebuild(state) {
    for (const view of Object.values(views)) view.destroy();
    views = {};
    root.replaceChildren();
    root.classList.add('app');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', t('ui.panelTitle'));
    root.append(buildDrawerHeader());

    const grid = el('section', 'scenarios');
    for (const slot of state.scenarios.B ? ['A', 'B'] : ['A']) {
      const section = el('article', 'scenario');
      grid.append(section);
      views[slot] = createView(slot, section);
    }
    const footer = el('footer', 'app-footer');
    footer.append(el('p', 'app-attribution', t('app.attribution')), el('p', 'app-team', `${t('app.team')}: ${TEAM.join(' · ')}`));
    root.append(grid, footer);
  }

  /** Open or close the drawer; closed, it is taken out of the tab order and hidden from screen readers. */
  function syncDrawer(state) {
    const open = Boolean(state.panelOpen);
    root.classList.toggle('open', open);
    root.classList.toggle('compare-open', Boolean(state.scenarios.B));
    root.setAttribute('aria-hidden', String(!open));
    if (open) root.removeAttribute('inert');
    else root.setAttribute('inert', '');
  }

  function update(state) {
    const key = `${state.locale}|${state.scenarios.B ? 'AB' : 'A'}`;
    if (key !== structureKey) {
      structureKey = key;
      rebuild(state);
    }
    syncDrawer(state);
    const metricsA = views.A.update(state);
    if (views.B && metricsA) views.B.update(state, metricsA);
  }

  store.subscribe(update);
  update(store.get());
}
