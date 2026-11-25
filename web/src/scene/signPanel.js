import { formatDurationLong, getLocale, t } from '../i18n.js';
import { formatTripTime } from './trip.js';

/** The start screen, where another site is picked; relative like the game link so it works under any base path. */
const START_URL = './inicio/index.html';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const percent = (fraction) => `${Math.round(fraction * 100)} %`;

/** "pgda.gsfc.nasa.gov", "doi.org"... used as the visible name of a source link. */
function sourceLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function dataBlock(overview) {
  const from = new Date(overview.fromMs).getUTCFullYear();
  const to = new Date(overview.toMs).getUTCFullYear();
  const list = el('dl', 'scene-sign-data');
  // each figure is a short heading and one plain sentence that says what it means
  const rows = [
    ['sign.sunFraction', percent(overview.sunFraction)],
    ['sign.longestSun', formatDurationLong(overview.longestSunMs)],
    ['sign.longestDark', formatDurationLong(overview.longestDarkMs)],
    ['sign.earthFraction', percent(overview.earthFraction)],
    ['sign.longestEarthGap', formatDurationLong(overview.longestEarthGapMs)],
  ];
  for (const [key, value] of rows) {
    const row = el('div');
    row.append(el('dt', '', t(key)), el('dd', '', t(`${key}Text`, { value })));
    list.append(row);
  }
  const wrap = el('section', 'scene-sign-block');
  wrap.append(el('h4', '', t('sign.data', { from, to })), list, el('p', 'scene-sign-note', t('sign.dataNote')));
  return wrap;
}

/**
 * The site sign shown when the robot reaches the goal. Closed, it is hidden from
 * assistive technology (aria-hidden) and, through CSS, from the tab order.
 * @returns {{el: HTMLElement, setInfo(info: object, locale: string): void, setOpen(open: boolean): void, isOpen(): boolean}}
 */
export function createSignPanel() {
  const root = el('aside', 'scene-sign');
  root.setAttribute('role', 'status');
  root.setAttribute('aria-hidden', 'true');
  let open = false;
  let current = null; // { info, locale, overview } of the last setInfo, so setTrip can redraw
  let trip = null;

  /** Distance and time of the first arrival, with a way to pick another site. */
  function tripBlock() {
    const wrap = el('section', 'scene-sign-block scene-sign-trip-block');
    wrap.append(
      el('p', 'scene-sign-trip', t('sign.arrived', { distance: Math.round(trip.distanceM), time: formatTripTime(trip.seconds) })),
    );
    const again = el('a', 'scene-sign-again', t('sign.again'));
    again.href = `${START_URL}?lang=${getLocale()}`;
    wrap.append(again);
    return wrap;
  }

  function render() {
    const { info, locale, overview } = current;
    const sign = info.sign[locale] ?? info.sign.es;
    const facts = el('ul');
    for (const fact of sign.facts) facts.append(el('li', '', fact));
    const parts = [];
    if (trip) parts.push(tripBlock());
    parts.push(el('h3', '', sign.title), el('p', '', sign.body));
    if (sign.why) {
      const why = el('section', 'scene-sign-block');
      why.append(el('h4', '', t('sign.why')), el('p', '', sign.why));
      parts.push(why);
    }
    parts.push(facts);
    if (overview) parts.push(dataBlock(overview));
    if (info.sources?.length) {
      const sources = el('p', 'scene-sign-sources');
      sources.append(`${t('sign.sources')}: `);
      info.sources.forEach((url, i) => {
        const link = el('a', '', sourceLabel(url));
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        if (i > 0) sources.append(' · ');
        sources.append(link);
      });
      parts.push(sources);
    }
    parts.push(el('p', 'scene-sign-hint', t('scene.signClose')));
    root.replaceChildren(...parts);
  }

  return {
    el: root,
    /**
     * @param {object} info the site's info.json
     * @param {string} locale
     * @param {object} [overview] whole-dataset statistics (see siteOverview); omitted in tests
     */
    setInfo(info, locale, overview = null) {
      current = { info, locale, overview };
      render();
    },
    /**
     * Show (or, with null, hide) the result of the drive to the lander at the top of the sign.
     * @param {{distanceM: number, seconds: number}|null} next
     */
    setTrip(next) {
      trip = next;
      if (current) render();
    },
    setOpen(next) {
      open = Boolean(next);
      root.classList.toggle('open', open);
      root.setAttribute('aria-hidden', String(!open));
    },
    isOpen: () => open,
  };
}
