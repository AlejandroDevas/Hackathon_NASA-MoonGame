import { setLocale, t } from '../i18n.js';
import { evaluateScenario, viability } from '../metrics/scenario.js';
import { renderDiff } from './compare.js';
import { clampTime, renderControls } from './controls.js';
import { createPlayer } from './player.js';
import { renderScenarioCard } from './scenarioCard.js';

const HOUR_MS = 3_600_000;
const SPEEDS = [
  { key: 'speed.1h', ms: HOUR_MS },
  { key: 'speed.6h', ms: 6 * HOUR_MS },
  { key: 'speed.1d', ms: 24 * HOUR_MS },
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Mount the whole planner UI into `root` and keep it in sync with `store`.
 * @param {HTMLElement} root
 * @param {object} store state store (see state.js)
 * @param {Array<{id: string, name: string}>} siteList
 * @param {Map<string, object>} sites loaded sites by id
 * @param {{renderTimeline: Function}} deps chart renderer, injected so the panel does not depend on uPlot
 */
export function mountPanel(root, store, siteList, sites, { renderTimeline, audioCue }) {
  let player = null;
  let speedMs = SPEEDS[1].ms;
  let structureKey = null;
  let views = {};
  let playButton = null;
  let soundButton = null;
  let shadowButton = null;
  let viewButton = null;

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
        renderScenarioCard(cardEl, metrics, viability(metrics, state.thresholds), site.info);
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
              player?.stop(); // dragging takes over from the animation
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

  function buildHeader() {
    const header = el('header', 'app-header');
    header.append(el('h1', '', t('app.title')));
    const tools = el('div', 'header-tools');

    const locale = el('select');
    locale.dataset.testid = 'locale';
    locale.setAttribute('aria-label', t('ctl.language'));
    for (const code of ['es', 'en']) locale.add(new Option(code.toUpperCase(), code, false, code === store.get().locale));
    locale.addEventListener('change', () => {
      setLocale(locale.value);
      store.set({ locale: locale.value });
    });

    const speed = el('select');
    speed.dataset.testid = 'speed';
    speed.setAttribute('aria-label', t('ctl.speed'));
    for (const s of SPEEDS) speed.add(new Option(t(s.key), String(s.ms), false, s.ms === speedMs));
    speed.addEventListener('change', () => {
      speedMs = Number(speed.value);
      if (store.get().playing) {
        player?.stop();
        player = createPlayer(store, sites, speedMs);
        player.start();
      }
    });

    playButton = el('button');
    playButton.dataset.testid = 'play-toggle';
    playButton.addEventListener('click', () => {
      if (store.get().playing) {
        player?.stop();
      } else {
        player = createPlayer(store, sites, speedMs);
        player.start();
      }
    });

    soundButton = el('button');
    soundButton.dataset.testid = 'sound-toggle';
    soundButton.addEventListener('click', () => {
      const enabled = !store.get().soundEnabled;
      const active = audioCue ? audioCue.setEnabled(enabled) : enabled;
      store.set({ soundEnabled: active });
    });

    shadowButton = el('button');
    shadowButton.dataset.testid = 'shadow-lift-toggle';
    shadowButton.addEventListener('click', () => store.set({ shadowLift: !store.get().shadowLift }));

    viewButton = el('button');
    viewButton.dataset.testid = 'view-toggle';
    viewButton.addEventListener('click', () => store.set({ viewMode: store.get().viewMode === 'free' ? 'follow' : 'free' }));

    const compare = el('button', '', store.get().scenarios.B ? t('app.compareOff') : t('app.compare'));
    compare.dataset.testid = 'compare-toggle';
    compare.addEventListener('click', () => {
      const { scenarios } = store.get();
      store.set({ scenarios: { A: scenarios.A, B: scenarios.B ? null : { ...scenarios.A } } });
    });

    tools.append(locale, speed, playButton, soundButton, shadowButton, viewButton, compare);
    header.append(tools);
    return header;
  }

  function rebuild(state) {
    for (const view of Object.values(views)) view.destroy();
    views = {};
    root.replaceChildren();
    root.classList.add('app');
    root.append(buildHeader());

    const grid = el('section', 'scenarios');
    for (const slot of state.scenarios.B ? ['A', 'B'] : ['A']) {
      const section = el('article', 'scenario');
      grid.append(section);
      views[slot] = createView(slot, section);
    }
    root.append(grid, el('footer', 'app-footer', t('app.attribution')));
  }

  function update(state) {
    const key = `${state.locale}|${state.scenarios.B ? 'AB' : 'A'}`;
    if (key !== structureKey) {
      structureKey = key;
      rebuild(state);
    }
    document.documentElement.lang = state.locale;
    playButton.textContent = state.playing ? t('app.pause') : t('app.play');
    playButton.setAttribute('aria-pressed', String(state.playing));
    soundButton.textContent = state.soundEnabled ? t('app.soundOff') : t('app.soundOn');
    soundButton.setAttribute('aria-pressed', String(state.soundEnabled));
    soundButton.setAttribute('aria-label', state.soundEnabled ? t('app.soundOff') : t('app.soundOn'));
    shadowButton.textContent = t('app.shadowLift');
    shadowButton.setAttribute('aria-pressed', String(Boolean(state.shadowLift)));
    viewButton.textContent = state.viewMode === 'free' ? t('app.viewFollow') : t('app.viewFree');
    viewButton.setAttribute('aria-pressed', String(state.viewMode === 'free'));
    const metricsA = views.A.update(state);
    if (views.B && metricsA) views.B.update(state, metricsA);
  }

  store.subscribe(update);
  update(store.get());
}
