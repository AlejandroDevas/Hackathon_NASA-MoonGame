import { t } from '../i18n.js';
import { nextEvent } from '../metrics/events.js';
import { icon } from './icons.js';
import { attachMenu } from './menu.js';
import { SKIPS, SPEEDS } from './playback.js';

const DAY_MS = 86_400_000;

/** How much of the calculated time the line covers: all of it, or a window the visitor can drag within. */
export const RANGES = [
  { id: 'all', key: 'player.range.all', short: 'player.rangeShort.all', ms: null },
  { id: 'year', key: 'player.range.year', short: 'player.rangeShort.year', ms: 365 * DAY_MS },
  { id: 'month', key: 'player.range.month', short: 'player.rangeShort.month', ms: 30 * DAY_MS },
  { id: 'week', key: 'player.range.week', short: 'player.rangeShort.week', ms: 7 * DAY_MS },
];

/** The moments the events menu can jump to: [body, kind, key of its text]. */
export const EVENTS = [
  { id: 'sunrise', body: 'sun', kind: 'rise', key: 'player.event.sunrise' },
  { id: 'sunset', body: 'sun', kind: 'set', key: 'player.event.sunset' },
  { id: 'earthrise', body: 'earth', kind: 'rise', key: 'player.event.earthrise' },
  { id: 'earthset', body: 'earth', kind: 'set', key: 'player.event.earthset' },
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** "2027-01-14 08:00 UTC" */
export function formatMoment(ms) {
  return `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/**
 * Where January 1st of each year falls along a bar that spans [startMs, endMs], as 0..100 %.
 * Only years whose January 1st lies strictly inside the range are returned.
 */
export function yearMarks(startMs, endMs) {
  const marks = [];
  for (let year = new Date(startMs).getUTCFullYear() + 1; ; year++) {
    const at = Date.UTC(year, 0, 1);
    if (at >= endMs) break;
    marks.push({ year, percent: ((at - startMs) / (endMs - startMs)) * 100 });
  }
  return marks;
}

/**
 * The part of the data the line covers. With no range it is all of it; with one, a window of that length that
 * keeps its place while the moment stays inside it, and is centred on the moment when it is chosen or left.
 * @param {{startMs: number, endMs: number}} data first and last moment of the data
 * @param {number|null} rangeMs
 * @param {number} timeMs the moment on show
 * @param {number|null} windowStartMs where the window was
 * @returns {{startMs: number, endMs: number, zoomed: boolean}}
 */
export function windowFor(data, rangeMs, timeMs, windowStartMs) {
  if (!rangeMs || rangeMs >= data.endMs - data.startMs) return { startMs: data.startMs, endMs: data.endMs, zoomed: false };
  let start = windowStartMs;
  if (start === null || timeMs < start || timeMs > start + rangeMs) start = timeMs - rangeMs / 2;
  start = Math.min(Math.max(start, data.startMs), data.endMs - rangeMs);
  return { startMs: start, endMs: start + rangeMs, zoomed: true };
}

/** Fills the radio items of a popup menu, and keeps its trigger in step. Returns the items. */
function radioItems(menu, specs, onPick) {
  return specs.map((spec) => {
    const item = el('button', 'menu-item');
    item.type = 'button';
    item.setAttribute('role', 'menuitemradio');
    item.dataset.testid = spec.testId;
    const text = el('span', 'menu-text');
    const mark = icon('check');
    mark.classList.add('menu-check');
    item.append(text, mark);
    item.addEventListener('click', () => onPick(spec));
    menu.append(item);
    return { spec, item, text };
  });
}

/**
 * The bottom bar, like a video player: skip back and forward, play (a triangle that turns into a
 * pause sign), a line to choose a moment, the current moment, and three small controls: a menu that jumps to
 * the next sunrise, sunset, Earth-rise or Earth-set, how much of the time the line covers, and the speed.
 * @param {{get(): object}} store
 * @param {Map<string, object>} sites
 * @param {ReturnType<import('./playback.js').createPlayback>} playback
 */
export function createPlayBar(store, sites, playback) {
  const bar = el('footer', 'playbar');
  bar.setAttribute('role', 'group');
  let range = RANGES[0];
  let windowStartMs = null;

  function skipButton(testId, iconName, amount, deltaMs) {
    const button = el('button', 'pb-button pb-skip');
    button.type = 'button';
    button.dataset.testid = testId;
    button.append(icon(iconName), el('span', 'pb-skip-text', amount));
    button.addEventListener('click', () => playback.shiftBy(deltaMs));
    return button;
  }
  const backDay = skipButton('skip-back-day', 'back', '1 d', -SKIPS.day);
  const backHour = skipButton('skip-back-hour', 'back', '1 h', -SKIPS.hour);
  const forwardHour = skipButton('skip-fwd-hour', 'forward', '1 h', SKIPS.hour);
  const forwardDay = skipButton('skip-fwd-day', 'forward', '1 d', SKIPS.day);

  const play = el('button', 'pb-play');
  play.type = 'button';
  play.dataset.testid = 'play-toggle';
  play.addEventListener('click', () => playback.toggle());

  const transport = el('div', 'pb-transport');
  transport.append(backDay, backHour, play, forwardHour, forwardDay);

  // the line to pick a moment
  const seekWrap = el('div', 'pb-seek');
  const moment = el('output', 'pb-moment');
  moment.dataset.testid = 'seek-time';
  const slider = el('input', 'pb-slider');
  slider.type = 'range';
  slider.min = '0';
  slider.step = '1';
  slider.dataset.testid = 'seek';
  slider.addEventListener('input', () => {
    const { eph } = sites.get(store.get().scenarios.A.siteId);
    playback.seekTo(eph.startMs + Number(slider.value) * eph.stepMs);
  });
  // letting go of the handle near the edge of a zoomed window re-centres the window on the moment
  slider.addEventListener('change', () => {
    if (!range.ms) return;
    const share = (Number(slider.value) - Number(slider.min)) / Math.max(Number(slider.max) - Number(slider.min), 1);
    if (share < 0.1 || share > 0.9) {
      windowStartMs = null;
      refresh(store.get());
    }
  });
  const years = el('div', 'pb-years');
  years.setAttribute('aria-hidden', 'true');
  const track = el('div', 'pb-track');
  track.append(slider, years);
  seekWrap.append(moment, track);

  // jump to the next sunrise, sunset, Earth-rise or Earth-set (looked up when the menu opens, not on every frame)
  const eventsWrap = el('div', 'pb-pop');
  const eventsButton = el('button', 'pb-button pb-icon-button');
  eventsButton.type = 'button';
  eventsButton.dataset.testid = 'events';
  eventsButton.append(icon('event'));
  const eventsMenu = el('div', 'menu-list menu-up');
  eventsMenu.setAttribute('role', 'menu');
  const eventItems = EVENTS.map((spec) => {
    const item = el('button', 'menu-item');
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    item.dataset.testid = `event-${spec.id}`;
    const text = el('span', 'menu-text');
    const when = el('span', 'menu-sub');
    text.append(el('span', 'menu-label'), when);
    item.append(text);
    item.addEventListener('click', () => {
      if (item.dataset.atMs) playback.seekTo(Number(item.dataset.atMs));
    });
    eventsMenu.append(item);
    return { spec, item, label: text.firstChild, when };
  });
  eventsWrap.append(eventsButton, eventsMenu);

  function refreshEvents() {
    const a = store.get().scenarios.A;
    const site = sites.get(a.siteId);
    for (const { spec, item, label, when } of eventItems) {
      label.textContent = t(spec.key);
      const found = nextEvent(site, spec.body, spec.kind, a.timeMs);
      // just after the crossing, rounded up to the minute, so the body is on the new side of the horizon
      const atMs = found ? Math.ceil(found.atMs / 60_000) * 60_000 : null;
      if (atMs === null) {
        delete item.dataset.atMs;
        item.disabled = true;
        item.setAttribute('aria-disabled', 'true');
        when.textContent = t('player.event.none');
      } else {
        item.dataset.atMs = String(atMs);
        item.disabled = false;
        item.removeAttribute('aria-disabled');
        when.textContent = formatMoment(atMs);
      }
    }
  }
  attachMenu({ trigger: eventsButton, menu: eventsMenu, onOpenChange: (open) => open && refreshEvents() });

  // how much of the time the line covers
  const rangeWrap = el('div', 'pb-pop');
  const rangeButton = el('button', 'pb-button pb-range-button');
  rangeButton.type = 'button';
  rangeButton.dataset.testid = 'range';
  const rangeLabel = el('span', 'pb-range-text');
  rangeButton.append(icon('zoom'), rangeLabel);
  const rangeMenu = el('div', 'menu-list menu-up');
  rangeMenu.setAttribute('role', 'menu');
  const rangeItems = radioItems(rangeMenu, RANGES.map((r) => ({ ...r, testId: `range-${r.id}` })), (spec) => {
    range = spec;
    windowStartMs = null;
    refresh(store.get());
  });
  rangeWrap.append(rangeButton, rangeMenu);
  attachMenu({ trigger: rangeButton, menu: rangeMenu });

  // speed button with its menu
  const speedWrap = el('div', 'pb-pop pb-speed');
  const speedButton = el('button', 'pb-button pb-speed-button');
  speedButton.type = 'button';
  speedButton.dataset.testid = 'speed';
  const speedLabel = el('span', 'pb-speed-text');
  speedButton.append(icon('speed'), speedLabel, icon('chevron'));
  const speedMenu = el('div', 'menu-list menu-up');
  speedMenu.setAttribute('role', 'menu');
  const speedItems = radioItems(speedMenu, SPEEDS.map((s) => ({ ...s, testId: `speed-${s.ms}` })), (spec) => {
    playback.setSpeed(spec.ms);
    refresh(store.get()); // changing the speed of a paused animation changes no state, so refresh by hand
  });
  speedWrap.append(speedButton, speedMenu);
  attachMenu({ trigger: speedButton, menu: speedMenu });

  const tools = el('div', 'pb-tools');
  tools.append(eventsWrap, rangeWrap, speedWrap);
  bar.append(transport, seekWrap, tools);

  let marksKey = null;

  function drawMarks(eph, win) {
    const key = `${eph.startMs}|${win.startMs}|${win.endMs}|${win.zoomed}`;
    if (key === marksKey) return;
    marksKey = key;
    years.replaceChildren();
    if (!win.zoomed) {
      for (const mark of yearMarks(win.startMs, win.endMs)) {
        const tick = el('span', 'pb-year', String(mark.year));
        tick.style.left = `${mark.percent}%`;
        years.append(tick);
      }
      return;
    }
    // zoomed: the dates at the two ends and the middle
    for (const share of [0, 0.5, 1]) {
      const tick = el('span', 'pb-year', new Date(win.startMs + (win.endMs - win.startMs) * share).toISOString().slice(0, 10));
      if (share === 0) tick.classList.add('pb-year-start'); // the end labels stay inside the bar
      if (share === 1) tick.classList.add('pb-year-end');
      tick.style.left = `${share * 100}%`;
      years.append(tick);
    }
  }

  function refresh(state) {
    const a = state.scenarios.A;
    const { eph } = sites.get(a.siteId);
    const last = eph.count - 1;
    const endMs = eph.startMs + last * eph.stepMs;
    const index = Math.min(Math.max(Math.round((a.timeMs - eph.startMs) / eph.stepMs), 0), last);

    const win = windowFor({ startMs: eph.startMs, endMs }, range.ms, a.timeMs, windowStartMs);
    windowStartMs = win.zoomed ? win.startMs : null;
    const min = Math.round((win.startMs - eph.startMs) / eph.stepMs);
    const max = Math.round((win.endMs - eph.startMs) / eph.stepMs);
    if (slider.min !== String(min)) slider.min = String(min);
    if (slider.max !== String(max)) slider.max = String(max);
    if (slider.value !== String(index)) slider.value = String(index);
    const span = max - min;
    slider.style.setProperty('--progress', `${span > 0 ? ((index - min) / span) * 100 : 0}%`);
    const label = formatMoment(a.timeMs);
    moment.textContent = label;
    slider.setAttribute('aria-label', t('player.seek'));
    slider.setAttribute('aria-valuetext', label);
    drawMarks(eph, win);

    play.replaceChildren(icon(state.playing ? 'pause' : 'play'));
    const playLabel = state.playing ? t('app.pause') : t('app.play');
    play.setAttribute('aria-label', playLabel);
    play.title = `${playLabel} (${t('player.spaceKey')})`;
    play.setAttribute('aria-pressed', String(Boolean(state.playing)));

    backDay.setAttribute('aria-label', t('player.back1d'));
    backDay.title = t('player.back1d');
    backHour.setAttribute('aria-label', t('player.back1h'));
    backHour.title = `${t('player.back1h')} (,)`;
    forwardHour.setAttribute('aria-label', t('player.fwd1h'));
    forwardHour.title = `${t('player.fwd1h')} (.)`;
    forwardDay.setAttribute('aria-label', t('player.fwd1d'));
    forwardDay.title = t('player.fwd1d');

    for (const { spec, label } of eventItems) label.textContent = t(spec.key); // the times are looked up when the menu opens
    eventsButton.setAttribute('aria-label', t('player.events'));
    eventsButton.title = t('player.events');
    rangeLabel.textContent = t(range.short);
    rangeButton.setAttribute('aria-label', `${t('player.range')}: ${t(range.key)}`);
    rangeButton.title = t('player.range');
    for (const { spec, item, text } of rangeItems) {
      text.textContent = t(spec.key);
      item.setAttribute('aria-checked', String(spec.id === range.id));
    }

    const current = SPEEDS.find((s) => s.ms === playback.speedMs) ?? SPEEDS[0];
    speedLabel.textContent = t(current.key);
    speedButton.setAttribute('aria-label', `${t('ctl.speed')}: ${t(current.key)}`);
    speedButton.title = `${t('ctl.speed')} ([ ])`;
    for (const { spec, item, text } of speedItems) {
      text.textContent = t(spec.key);
      item.setAttribute('aria-checked', String(spec.ms === current.ms));
    }
  }

  return { el: bar, refresh };
}
