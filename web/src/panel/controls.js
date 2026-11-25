import { t } from '../i18n.js';

const HOUR_MS = 3_600_000;
const WINDOWS = [
  { key: 'ctl.window.1d', ms: 24 * HOUR_MS },
  { key: 'ctl.window.7d', ms: 7 * 24 * HOUR_MS },
  { key: 'ctl.window.lunar', ms: 29.5 * 24 * HOUR_MS },
];

/** The analysis windows the planner offers, in ms (a saved choice must be one of them). */
export const WINDOW_MS = WINDOWS.map((w) => w.ms);

/** Clamp `timeMs` to the ephemeris range. */
export function clampTime(eph, timeMs) {
  const last = eph.startMs + (eph.count - 1) * eph.stepMs;
  if (timeMs < eph.startMs) return { timeMs: eph.startMs, clamped: true };
  if (timeMs > last) return { timeMs: last, clamped: true };
  return { timeMs, clamped: false };
}

const toInputValue = (ms) => new Date(ms).toISOString().slice(0, 16);
const toDisplay = (ms) => `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;

function field(labelText, control) {
  const label = document.createElement('label');
  label.className = 'field';
  const span = document.createElement('span');
  span.textContent = labelText;
  label.append(span, control);
  return label;
}

function numberInput(testId, value, onChange) {
  const input = document.createElement('input');
  input.type = 'number';
  input.dataset.testid = testId;
  input.value = String(value);
  input.addEventListener('change', () => {
    const parsed = Number(input.value);
    if (Number.isFinite(parsed)) onChange(parsed);
  });
  return input;
}

/**
 * Site, date and window controls for one scenario slot, plus the viability thresholds.
 * @param {HTMLElement} container
 * @param {{get(): object, set(p: object): void}} store
 * @param {Array<{id: string, name: string}>} siteList
 * @param {Map<string, object>} sites loaded sites by id
 * @param {'A'|'B'} slot
 */
export function renderControls(container, store, siteList, sites, slot) {
  container.replaceChildren();
  container.classList.add('controls');
  const scenario = store.get().scenarios[slot];

  const update = (patch) => {
    const state = store.get();
    store.set({ scenarios: { ...state.scenarios, [slot]: { ...state.scenarios[slot], ...patch } } });
  };

  const select = document.createElement('select');
  select.dataset.testid = `site-${slot}`;
  for (const entry of siteList) select.add(new Option(entry.name, entry.id, false, entry.id === scenario.siteId));
  select.addEventListener('change', () => update({ siteId: select.value }));

  const warning = document.createElement('div');
  warning.className = 'range-warning';
  warning.dataset.testid = 'range-warning';
  warning.hidden = true;

  const time = document.createElement('input');
  time.type = 'datetime-local';
  time.dataset.testid = `time-${slot}`;
  time.value = toInputValue(scenario.timeMs);
  time.addEventListener('change', () => {
    const parsed = Date.parse(`${time.value}:00Z`);
    if (Number.isNaN(parsed)) return;
    const eph = sites.get(store.get().scenarios[slot].siteId).eph;
    const { timeMs, clamped } = clampTime(eph, parsed);
    // Browsers fire `change` while a year is still being typed: never overwrite
    // the field under the user's cursor; it is corrected on blur instead.
    if (document.activeElement !== time) time.value = toInputValue(timeMs);
    warning.hidden = !clamped;
    warning.textContent = clamped ? t('range.warning', { limit: toDisplay(timeMs) }) : '';
    update({ timeMs });
  });
  time.addEventListener('blur', () => {
    time.value = toInputValue(store.get().scenarios[slot].timeMs);
  });

  container.append(field(t('ctl.site'), select), field(t('ctl.time'), time), warning);

  if (slot === 'A') {
    const windowSelect = document.createElement('select');
    windowSelect.dataset.testid = 'window';
    for (const w of WINDOWS) windowSelect.add(new Option(t(w.key), String(w.ms), false, w.ms === store.get().windowMs));
    windowSelect.addEventListener('change', () => store.set({ windowMs: Number(windowSelect.value) }));
    container.append(field(t('ctl.window'), windowSelect));

    const thresholds = store.get().thresholds;
    const setThreshold = (key) => (value) => store.set({ thresholds: { ...store.get().thresholds, [key]: value } });
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = t('ctl.thresholds');
    details.append(
      summary,
      field(t('ctl.minSunEl'), numberInput('min-sun-el', thresholds.minSunElDeg, setThreshold('minSunElDeg'))),
      field(t('ctl.maxDark'), numberInput('max-dark', thresholds.maxDarkH, setThreshold('maxDarkH'))),
      field(t('ctl.maxEarthGap'), numberInput('max-earth-gap', thresholds.maxEarthGapH, setThreshold('maxEarthGapH'))),
    );
    container.append(details);
  }
}
