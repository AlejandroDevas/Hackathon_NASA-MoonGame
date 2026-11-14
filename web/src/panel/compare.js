import { formatDuration, t } from '../i18n.js';

const MINUS = '−';

const FIELDS = [
  { key: 'sunFraction', label: 'card.sunFraction', kind: 'fraction', better: 'up' },
  { key: 'earthFraction', label: 'card.earthFraction', kind: 'fraction', better: 'up' },
  { key: 'longestDarkMs', label: 'card.longestDark', kind: 'duration', better: 'down' },
  { key: 'longestEarthGapMs', label: 'card.longestEarthGap', kind: 'duration', better: 'down' },
];

/** b - a for the four fields that can be compared across scenarios. */
export function diffMetrics(a, b) {
  const out = {};
  for (const { key } of FIELDS) out[key] = b[key] - a[key];
  return out;
}

function isNegligible(field, delta) {
  return field.kind === 'fraction' ? Math.round(Math.abs(delta) * 100) === 0 : Math.abs(delta) < 60_000;
}

/** 'better' | 'worse' | 'same' for a change `delta` (b - a) of the field `key`. */
export function diffClass(key, delta) {
  const field = FIELDS.find((f) => f.key === key);
  if (isNegligible(field, delta)) return 'same';
  const up = delta > 0;
  return up === (field.better === 'up') ? 'better' : 'worse';
}

function formatDelta(field, delta) {
  if (isNegligible(field, delta)) return field.kind === 'fraction' ? '0 pp' : '0 min';
  const sign = delta > 0 ? '+' : MINUS;
  return field.kind === 'fraction'
    ? `${sign}${Math.round(Math.abs(delta) * 100)} pp`
    : `${sign}${formatDuration(Math.abs(delta))}`;
}

/** Fill `container` with the signed differences of scenario `b` relative to `a`. */
export function renderDiff(container, a, b) {
  container.replaceChildren();
  container.classList.add('diffs');
  const title = document.createElement('div');
  title.className = 'diffs-title';
  title.textContent = t('diff.title');
  container.append(title);

  const delta = diffMetrics(a, b);
  for (const field of FIELDS) {
    const row = document.createElement('div');
    row.className = 'diff-row';
    const label = document.createElement('span');
    label.textContent = t(field.label);
    const value = document.createElement('strong');
    value.dataset.testid = `diff-${field.key}`;
    value.className = diffClass(field.key, delta[field.key]);
    value.textContent = formatDelta(field, delta[field.key]);
    row.append(label, value);
    container.append(row);
  }
}
