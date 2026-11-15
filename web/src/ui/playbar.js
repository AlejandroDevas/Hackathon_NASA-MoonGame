import { t } from '../i18n.js';
import { icon } from './icons.js';
import { attachMenu } from './menu.js';
import { SKIPS, SPEEDS } from './playback.js';

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
 * The bottom bar, like a video player: skip back and forward, play (a triangle that turns into a
 * pause sign), a line to choose any moment of all the time that was calculated, the current moment,
 * and a button for the speed of playback.
 * @param {{get(): object}} store
 * @param {Map<string, object>} sites
 * @param {ReturnType<import('./playback.js').createPlayback>} playback
 */
export function createPlayBar(store, sites, playback) {
  const bar = el('footer', 'playbar');
  bar.setAttribute('role', 'group');

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
  const years = el('div', 'pb-years');
  years.setAttribute('aria-hidden', 'true');
  const track = el('div', 'pb-track');
  track.append(slider, years);
  seekWrap.append(moment, track);

  // speed button with its menu
  const speedWrap = el('div', 'pb-speed');
  const speedButton = el('button', 'pb-button pb-speed-button');
  speedButton.type = 'button';
  speedButton.dataset.testid = 'speed';
  const speedLabel = el('span', 'pb-speed-text');
  speedButton.append(icon('speed'), speedLabel, icon('chevron'));
  const speedMenu = el('div', 'menu-list menu-up');
  speedMenu.setAttribute('role', 'menu');
  const speedItems = SPEEDS.map((speed) => {
    const item = el('button', 'menu-item');
    item.type = 'button';
    item.setAttribute('role', 'menuitemradio');
    item.dataset.testid = `speed-${speed.ms}`;
    const text = el('span', 'menu-text');
    const mark = icon('check');
    mark.classList.add('menu-check');
    item.append(text, mark);
    item.addEventListener('click', () => {
      playback.setSpeed(speed.ms);
      refresh(store.get()); // changing the speed of a paused animation changes no state, so refresh by hand
    });
    speedMenu.append(item);
    return { speed, item, text };
  });
  speedWrap.append(speedButton, speedMenu);
  attachMenu({ trigger: speedButton, menu: speedMenu });

  bar.append(transport, seekWrap, speedWrap);

  let marksKey = null;

  function refresh(state) {
    const a = state.scenarios.A;
    const { eph } = sites.get(a.siteId);
    const max = eph.count - 1;
    const endMs = eph.startMs + max * eph.stepMs;
    const index = Math.min(Math.max(Math.round((a.timeMs - eph.startMs) / eph.stepMs), 0), max);

    if (slider.max !== String(max)) slider.max = String(max);
    if (slider.value !== String(index)) slider.value = String(index);
    slider.style.setProperty('--progress', `${max > 0 ? (index / max) * 100 : 0}%`);
    const label = formatMoment(a.timeMs);
    moment.textContent = label;
    slider.setAttribute('aria-label', t('player.seek'));
    slider.setAttribute('aria-valuetext', label);

    const key = `${eph.startMs}|${endMs}`;
    if (key !== marksKey) {
      marksKey = key;
      years.replaceChildren();
      for (const mark of yearMarks(eph.startMs, endMs)) {
        const tick = el('span', 'pb-year', String(mark.year));
        tick.style.left = `${mark.percent}%`;
        years.append(tick);
      }
    }

    play.replaceChildren(icon(state.playing ? 'pause' : 'play'));
    play.setAttribute('aria-label', state.playing ? t('app.pause') : t('app.play'));
    play.title = state.playing ? t('app.pause') : t('app.play');
    play.setAttribute('aria-pressed', String(Boolean(state.playing)));

    backDay.setAttribute('aria-label', t('player.back1d'));
    backDay.title = t('player.back1d');
    backHour.setAttribute('aria-label', t('player.back1h'));
    backHour.title = t('player.back1h');
    forwardHour.setAttribute('aria-label', t('player.fwd1h'));
    forwardHour.title = t('player.fwd1h');
    forwardDay.setAttribute('aria-label', t('player.fwd1d'));
    forwardDay.title = t('player.fwd1d');

    const current = SPEEDS.find((s) => s.ms === playback.speedMs) ?? SPEEDS[0];
    speedLabel.textContent = t(current.key);
    speedButton.setAttribute('aria-label', `${t('ctl.speed')}: ${t(current.key)}`);
    speedButton.title = t('ctl.speed');
    for (const { speed, item, text } of speedItems) {
      text.textContent = t(speed.key);
      item.setAttribute('aria-checked', String(speed.ms === current.ms));
    }
  }

  return { el: bar, refresh };
}
