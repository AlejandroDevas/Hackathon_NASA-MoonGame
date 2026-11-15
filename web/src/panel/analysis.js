import { formatDuration, getLocale, t } from '../i18n.js';
import { horizonAt } from '../metrics/visibility.js';
import { bestWindows, lightCalendar } from '../metrics/overview.js';
import { evaluateScenario, viability } from '../metrics/scenario.js';
import { clampTime } from './controls.js';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const CALENDAR_DAYS = 30;
const BEST_COUNT = 5;
const SVG_NS = 'http://www.w3.org/2000/svg';
const STAYS = [
  { key: 'analysis.stay3', ms: 3 * DAY_MS },
  { key: 'analysis.stay65', ms: 6.5 * DAY_MS },
  { key: 'analysis.stay14', ms: 14 * DAY_MS },
];
const DEFAULT_STAY_MS = STAYS[1].ms;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

const percent = (fraction) => `${Math.round(fraction * 100)} %`;
const dateText = (ms) => new Date(ms).toISOString().slice(0, 10);
const dateTimeText = (ms) => `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
const verdictBadge = (level) => el('span', `verdict verdict-${level}`, t(`verdict.${level}`));

function field(labelText, control) {
  const label = el('label', 'field');
  label.append(el('span', '', labelText), control);
  return label;
}

function section(titleKey, helpText) {
  const wrap = el('section', 'analysis-section');
  wrap.append(el('h3', '', t(titleKey)));
  if (helpText) wrap.append(el('p', 'analysis-help', helpText));
  return wrap;
}

/* ---------- best landing windows ---------- */

function renderBest(site, state, thresholds, onPick) {
  const eph = site.eph;
  const lastMs = eph.startMs + (eph.count - 1) * eph.stepMs;
  const wrap = section('analysis.best', t('analysis.bestHelp', { from: dateText(eph.startMs), to: dateText(lastMs), count: BEST_COUNT }));
  const windows = bestWindows(site, { stayMs: state.stayMs, count: BEST_COUNT, thresholds });
  if (!windows.length) {
    wrap.append(el('p', 'analysis-help', t('analysis.noWindows')));
    return wrap;
  }
  const table = el('table', 'analysis-table');
  table.dataset.testid = 'best-windows';
  const head = el('tr');
  for (const key of ['analysis.colStart', 'analysis.colSun', 'analysis.colEarth', 'analysis.colDark', 'analysis.colVerdict', '']) {
    head.append(el('th', '', key ? t(key) : ''));
  }
  const thead = el('thead');
  thead.append(head);
  table.append(thead);
  const body = el('tbody');
  for (const w of windows) {
    const row = el('tr');
    const pick = el('button', 'analysis-link', t('analysis.show'));
    pick.type = 'button';
    pick.addEventListener('click', () => onPick(w.startMs));
    const verdict = el('td');
    verdict.append(verdictBadge(w.verdict.level));
    const action = el('td');
    action.append(pick);
    row.append(
      el('td', 'mono', dateTimeText(w.startMs)),
      el('td', 'mono', percent(w.sunFraction)),
      el('td', 'mono', percent(w.earthFraction)),
      el('td', 'mono', formatDuration(w.metrics.longestDarkMs)),
      verdict,
      action,
    );
    body.append(row);
  }
  table.append(body);
  wrap.append(table);
  return wrap;
}

/* ---------- 30-day light calendar ---------- */

function renderCalendar(site, state) {
  const wrap = section('analysis.calendar', t('analysis.calendarHelp'));
  const calendar = lightCalendar(site, state.startMs, CALENDAR_DAYS);
  const CELL_W = 9;
  const CELL_H = 8;
  const LEFT = 44;
  const TOP = 22;
  const GAP = 34;
  const blockW = 24 * CELL_W;
  const width = LEFT + blockW * 2 + GAP + 8;
  const height = TOP + CALENDAR_DAYS * CELL_H + 8;
  const chart = svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'analysis-svg', role: 'img', 'aria-label': t('analysis.calendar') });
  chart.dataset.testid = 'calendar';

  const blocks = [
    { cells: calendar.sun, x: LEFT, cls: 'cal-sun', label: t('analysis.sunCal') },
    { cells: calendar.earth, x: LEFT + blockW + GAP, cls: 'cal-earth', label: t('analysis.earthCal') },
  ];
  for (const block of blocks) {
    chart.append(svg('text', { x: block.x, y: 10, class: 'chart-label chart-title' }, block.label));
    chart.append(svg('rect', { x: block.x, y: TOP, width: blockW, height: CALENDAR_DAYS * CELL_H, class: 'cal-bg' }));
    for (let day = 0; day < CALENDAR_DAYS; day++) {
      let hour = 0;
      while (hour < 24) {
        const value = block.cells[day * 24 + hour];
        let end = hour;
        while (end < 24 && block.cells[day * 24 + end] === value) end++;
        if (value !== 0) {
          chart.append(
            svg('rect', {
              x: block.x + hour * CELL_W,
              y: TOP + day * CELL_H,
              width: (end - hour) * CELL_W,
              height: CELL_H - 0.6,
              class: value === 1 ? block.cls : 'cal-nodata',
            }),
          );
        }
        hour = end;
      }
    }
    for (const h of [0, 6, 12, 18, 24]) {
      chart.append(svg('text', { x: block.x + h * CELL_W, y: TOP - 4, class: 'chart-label', 'text-anchor': 'middle' }, String(h)));
    }
  }
  for (let day = 0; day < CALENDAR_DAYS; day += 5) {
    chart.append(
      svg('text', { x: LEFT - 5, y: TOP + day * CELL_H + CELL_H - 1, class: 'chart-label', 'text-anchor': 'end' }, dateText(state.startMs + day * DAY_MS).slice(5)),
    );
  }
  wrap.append(chart, el('p', 'analysis-axis', t('analysis.hourAxis')));
  return wrap;
}

/* ---------- sky plot ---------- */

const SKY_EL_MAX = 30;
const SKY_EL_MIN = -5;

function renderSky(site, state) {
  const wrap = section('analysis.sky', t('analysis.skyHelp'));
  const SIZE = 340;
  const C = SIZE / 2;
  const R = C - 24;
  const radius = (elDeg) => (R * (SKY_EL_MAX - Math.min(Math.max(elDeg, SKY_EL_MIN), SKY_EL_MAX))) / (SKY_EL_MAX - SKY_EL_MIN);
  const point = (azDeg, elDeg) => {
    const r = radius(elDeg);
    const az = (azDeg * Math.PI) / 180;
    return [C + r * Math.sin(az), C - r * Math.cos(az)];
  };
  const chart = svg('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'analysis-svg analysis-sky', role: 'img', 'aria-label': t('analysis.sky') });
  chart.dataset.testid = 'sky-plot';

  // terrain: the ring between the horizon silhouette and the outer edge
  const outer = `M ${C - R} ${C} a ${R} ${R} 0 1 0 ${2 * R} 0 a ${R} ${R} 0 1 0 ${-2 * R} 0 Z`;
  const profile = [];
  for (let az = 0; az < 360; az++) profile.push(point(az, site.horizon[az]));
  const horizonPath = `M ${profile.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')} Z`;
  chart.append(svg('path', { d: `${outer} ${horizonPath}`, 'fill-rule': 'evenodd', class: 'sky-terrain' }));
  chart.append(svg('path', { d: horizonPath, class: 'sky-horizon' }));

  for (const el of [0, 10, 20]) {
    chart.append(svg('circle', { cx: C, cy: C, r: radius(el), class: 'sky-ring' }));
    chart.append(svg('text', { x: C + 3, y: C - radius(el) - 2, class: 'chart-label' }, `${el}°`));
  }
  for (const [label, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
    const [x, y] = point(az, SKY_EL_MIN - 4);
    chart.append(svg('text', { x, y: y + 4, class: 'chart-label chart-title', 'text-anchor': 'middle' }, label));
  }

  const { eph, info } = site;
  const sunR = info.bodies.sun_radius_deg;
  const earthR = info.bodies.earth_radius_deg;
  const first = Math.max(0, Math.round((state.startMs - eph.startMs) / eph.stepMs));
  const last = Math.min(eph.count - 1, first + CALENDAR_DAYS * 24);
  const stride = Math.max(1, Math.round((3 * HOUR_MS) / eph.stepMs));
  for (let i = first; i <= last; i += stride) {
    const bodies = [
      ['sky-sun', eph.sunAz[i], eph.sunEl[i], sunR],
      ['sky-earth', eph.earthAz[i], eph.earthEl[i], earthR],
    ];
    for (const [cls, az, elDeg, bodyR] of bodies) {
      if (elDeg < SKY_EL_MIN) continue;
      const [x, y] = point(az, elDeg);
      const blocked = elDeg + bodyR <= horizonAt(site.horizon, az);
      chart.append(svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 1.9, class: `${cls}${blocked ? ' sky-blocked' : ''}` }));
    }
  }

  const legend = el('p', 'analysis-legend');
  legend.append(el('span', 'legend-sun', t('analysis.legendSun')), el('span', 'legend-earth', t('analysis.legendEarth')), el('span', 'legend-terrain', t('analysis.legendTerrain')));
  wrap.append(chart, legend);
  return wrap;
}

/* ---------- comparison of all sites ---------- */

export function comparisonRows(siteList, sites, startMs, windowMs, thresholds) {
  return siteList.map((entry) => {
    const site = sites.get(entry.id);
    const { timeMs } = clampTime(site.eph, startMs);
    const metrics = evaluateScenario(site, timeMs, windowMs);
    return { id: entry.id, name: entry.name, timeMs, metrics, verdict: viability(metrics, thresholds) };
  });
}

/** CSV of the comparison: one row per site, numbers with a dot, times in hours. */
export function comparisonCsv(rows, windowMs) {
  const header = ['site', 'start_utc', 'window_days', 'sun_percent', 'earth_percent', 'longest_light_h', 'longest_night_h', 'longest_earth_gap_h', 'verdict'];
  const lines = [header.join(',')];
  for (const r of rows) {
    const m = r.metrics;
    lines.push(
      [
        `"${r.name.replace(/"/g, '""')}"`,
        new Date(r.timeMs).toISOString(),
        (windowMs / DAY_MS).toFixed(1),
        (m.sunFraction * 100).toFixed(1),
        (m.earthFraction * 100).toFixed(1),
        (m.longestSunMs / HOUR_MS).toFixed(1),
        (m.longestDarkMs / HOUR_MS).toFixed(1),
        (m.longestEarthGapMs / HOUR_MS).toFixed(1),
        r.verdict.level,
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

function renderComparison(siteList, sites, state, thresholds) {
  const wrap = section('analysis.compare', t('analysis.compareHelp', { days: (state.stayMs / DAY_MS).toString().replace('.', getLocale() === 'es' ? ',' : '.') }));
  const rows = comparisonRows(siteList, sites, state.startMs, state.stayMs, thresholds);
  const best = (pick) => {
    const top = rows.reduce((a, b) => (pick(b.metrics) > pick(a.metrics) ? b : a));
    return pick(top.metrics) > 0 ? top.id : null;
  };
  const topSun = best((m) => m.sunFraction);
  const topEarth = best((m) => m.earthFraction);

  const table = el('table', 'analysis-table');
  table.dataset.testid = 'compare-table';
  const head = el('tr');
  for (const key of ['analysis.colSite', 'analysis.colSun', 'analysis.colEarth', 'analysis.colLight', 'analysis.colDark', 'analysis.colGap', 'analysis.colVerdict']) head.append(el('th', '', t(key)));
  const thead = el('thead');
  thead.append(head);
  table.append(thead);
  const body = el('tbody');
  for (const r of rows) {
    const tr = el('tr');
    const verdict = el('td');
    verdict.append(verdictBadge(r.verdict.level));
    tr.append(
      el('td', '', r.name),
      el('td', `mono${r.id === topSun ? ' best' : ''}`, percent(r.metrics.sunFraction)),
      el('td', `mono${r.id === topEarth ? ' best' : ''}`, percent(r.metrics.earthFraction)),
      el('td', 'mono', formatDuration(r.metrics.longestSunMs)),
      el('td', 'mono', formatDuration(r.metrics.longestDarkMs)),
      el('td', 'mono', formatDuration(r.metrics.longestEarthGapMs)),
      verdict,
    );
    body.append(tr);
  }
  table.append(body);

  const csv = el('button', 'analysis-link', t('analysis.csv'));
  csv.type = 'button';
  csv.dataset.testid = 'csv-download';
  csv.addEventListener('click', () => {
    const blob = new Blob([comparisonCsv(rows, state.stayMs)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = el('a');
    link.href = url;
    link.download = `lunar-sites-${dateText(state.startMs)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });
  wrap.append(table, csv);
  return wrap;
}

/**
 * The expanded analysis window: best landing windows, a 30-day light calendar, a
 * sky plot against the terrain horizon and a comparison of every site. It keeps its
 * own site/date/stay choices, so the animation of the main panel does not redraw it.
 * @param {{get(): object, set(p: object): void, subscribe(fn: Function): () => void}} store
 * @param {Array<{id: string, name: string}>} siteList
 * @param {Map<string, object>} sites
 */
export function createAnalysis(store, siteList, sites) {
  const overlay = el('div', 'analysis');
  overlay.hidden = true;
  overlay.dataset.testid = 'analysis';
  const dialog = el('div', 'analysis-dialog');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.tabIndex = -1;
  overlay.append(dialog);

  let open = false;
  let opener = null;
  let state = { siteId: null, startMs: 0, stayMs: DEFAULT_STAY_MS };
  let shownLocale = null;

  function update(patch) {
    state = { ...state, ...patch };
    render();
  }

  function pick(startMs) {
    const { scenarios } = store.get();
    store.set({ scenarios: { ...scenarios, A: { ...scenarios.A, siteId: state.siteId, timeMs: startMs } } });
    close();
  }

  function render() {
    const site = sites.get(state.siteId);
    const thresholds = store.get().thresholds;
    const { timeMs } = clampTime(site.eph, state.startMs);
    state = { ...state, startMs: timeMs };
    shownLocale = store.get().locale;

    const header = el('header', 'analysis-header');
    const name = siteList.find((s) => s.id === state.siteId)?.name ?? state.siteId;
    const heading = el('h2', '', t('analysis.title', { site: name }));
    heading.id = 'analysis-title';
    dialog.setAttribute('aria-labelledby', 'analysis-title');
    const close_ = el('button', 'analysis-close', t('analysis.close'));
    close_.type = 'button';
    close_.dataset.testid = 'analysis-close';
    close_.addEventListener('click', close);
    header.append(heading, close_);

    const siteSelect = el('select');
    siteSelect.dataset.testid = 'analysis-site';
    for (const entry of siteList) siteSelect.add(new Option(entry.name, entry.id, false, entry.id === state.siteId));
    siteSelect.addEventListener('change', () => update({ siteId: siteSelect.value }));

    const start = el('input');
    start.type = 'date';
    start.dataset.testid = 'analysis-start';
    start.value = dateText(state.startMs);
    start.min = dateText(site.eph.startMs);
    start.max = dateText(site.eph.startMs + (site.eph.count - 1) * site.eph.stepMs);
    start.addEventListener('change', () => {
      const parsed = Date.parse(`${start.value}T00:00:00Z`);
      if (!Number.isNaN(parsed)) update({ startMs: parsed });
    });

    const stay = el('select');
    stay.dataset.testid = 'analysis-stay';
    for (const s of STAYS) stay.add(new Option(t(s.key), String(s.ms), false, s.ms === state.stayMs));
    stay.addEventListener('change', () => update({ stayMs: Number(stay.value) }));

    const controls = el('div', 'analysis-controls');
    controls.append(field(t('analysis.site'), siteSelect), field(t('analysis.start'), start), field(t('analysis.stay'), stay));

    const grid = el('div', 'analysis-grid');
    grid.append(renderBest(site, state, thresholds, pick), renderCalendar(site, state), renderSky(site, state));
    const note = el('p', 'analysis-note', t('analysis.dataNote'));
    dialog.replaceChildren(header, controls, grid, renderComparison(siteList, sites, state, thresholds), note);
  }

  function trapFocus(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button, select, input, a[href]')].filter((n) => !n.disabled);
    if (!focusable.length) return;
    const firstEl = focusable[0];
    const lastEl = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === firstEl) {
      event.preventDefault();
      lastEl.focus();
    } else if (!event.shiftKey && document.activeElement === lastEl) {
      event.preventDefault();
      firstEl.focus();
    }
  }

  function openDialog() {
    if (open) return;
    const { scenarios } = store.get();
    state = { siteId: scenarios.A.siteId, startMs: scenarios.A.timeMs, stayMs: DEFAULT_STAY_MS };
    opener = document.activeElement;
    open = true;
    render();
    overlay.hidden = false;
    document.body.classList.add('analysis-open');
    document.addEventListener('keydown', trapFocus);
    dialog.querySelector('[data-testid="analysis-close"]')?.focus();
  }

  function close() {
    if (!open) return;
    open = false;
    overlay.hidden = true;
    document.body.classList.remove('analysis-open');
    document.removeEventListener('keydown', trapFocus);
    dialog.replaceChildren();
    if (opener && typeof opener.focus === 'function') opener.focus();
  }

  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) close();
  });
  document.body.append(overlay);
  const unsubscribe = store.subscribe((next) => {
    if (open && next.locale !== shownLocale) render();
  });

  return {
    el: overlay,
    open: openDialog,
    close,
    isOpen: () => open,
    dispose() {
      unsubscribe();
      document.removeEventListener('keydown', trapFocus);
      overlay.remove();
    },
  };
}
