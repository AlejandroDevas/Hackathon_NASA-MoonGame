import { formatDuration, getLocale, t } from '../i18n.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A label with its value; the value carries `data-testid` so it can be read on its own. */
function stat(label, testId, valueText, className = '') {
  const wrap = el('div', `stat ${className}`.trim());
  wrap.append(el('div', 'stat-label', label));
  const value = el('div', 'stat-value', valueText);
  value.dataset.testid = testId;
  wrap.append(value);
  return wrap;
}

const percent = (fraction) => `${Math.round(fraction * 100)} %`;
const degrees = (value) => `${value.toFixed(2)}°`;

function countdown(body, transition, timeMs) {
  if (!transition) return t('card.noChange');
  return formatDuration(transition.atMs - timeMs);
}

/**
 * Render one scenario's metrics into `container`.
 * @param {HTMLElement} container
 * @param {object} metrics result of evaluateScenario
 * @param {{level: string, failed: string[]}} verdict result of viability
 * @param {object} info the site's info.json
 */
export function renderScenarioCard(container, metrics, verdict, info) {
  const sign = info.sign[getLocale()] ?? info.sign.es;
  container.replaceChildren();
  container.classList.add('scenario-card');

  container.append(el('h2', 'card-title', sign.title));

  const badge = el('div', `verdict verdict-${verdict.level}`, t(`verdict.${verdict.level}`));
  badge.dataset.testid = 'verdict';
  container.append(badge);
  if (verdict.failed.length) {
    const reasons = el('div', 'verdict-reasons', verdict.failed.map((f) => t(`verdict.failed.${f}`)).join(' · '));
    reasons.dataset.testid = 'verdict-reasons';
    container.append(reasons);
  }

  const countdowns = el('div', 'countdowns');
  const sunLabel = metrics.nextSun?.kind === 'rise' ? 'card.sunRises' : 'card.sunSets';
  const earthLabel = metrics.nextEarth?.kind === 'rise' ? 'card.earthRises' : 'card.earthSets';
  countdowns.append(
    stat(t(sunLabel), 'sun-countdown', countdown('sun', metrics.nextSun, metrics.timeMs), 'big sun'),
    stat(t(earthLabel), 'earth-countdown', countdown('earth', metrics.nextEarth, metrics.timeMs), 'big earth'),
  );
  container.append(countdowns);

  const grid = el('div', 'stats');
  grid.append(
    stat(t('card.sunEl'), 'sun-el', degrees(metrics.sunElDeg)),
    stat(t('card.earthEl'), 'earth-el', degrees(metrics.earthElDeg)),
    stat(t('card.sunFraction'), 'sun-fraction', percent(metrics.sunFraction)),
    stat(t('card.earthFraction'), 'earth-fraction', percent(metrics.earthFraction)),
    stat(t('card.longestDark'), 'sun-dark', formatDuration(metrics.longestDarkMs)),
    stat(t('card.longestEarthGap'), 'earth-gap', formatDuration(metrics.longestEarthGapMs)),
  );
  container.append(grid);

  if (metrics.truncated) container.append(el('p', 'note', t('card.truncated')));
}
