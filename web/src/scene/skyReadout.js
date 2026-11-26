import { t } from '../i18n.js';
import { horizonAt } from '../metrics/visibility.js';

const STORAGE_KEY = 'inside-moon-153.sky-expanded';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function readExpanded() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeExpanded(on) {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    /* no storage: the choice lasts for this visit */
  }
}

/**
 * The panel that says where the Sun and the Earth are, for the site centre. Folded (the default) each body
 * is one short line: azimuth, height and whether it is up; unfolded it adds the horizon of the terrain in
 * that direction, in full words. The choice is remembered.
 * @returns {{el: HTMLElement, update(site: object, sky: {sun: object, earth: object}): void, setExpanded(on: boolean): void, isExpanded(): boolean}}
 */
export function createSkyReadout() {
  const root = el('div', 'scene-sky');
  const sunRow = el('div', 'scene-sky-row scene-sky-sun');
  const earthRow = el('div', 'scene-sky-row scene-sky-earth');
  const toggle = el('button', 'scene-sky-toggle');
  toggle.type = 'button';
  toggle.dataset.testid = 'sky-toggle';
  root.append(sunRow, earthRow, toggle);

  let expanded = readExpanded();
  let last = null; // the data of the last update, to draw again when the language or the fold changes

  function fillRow(node, nameKey, body, radiusDeg, horizon) {
    const horizonDeg = horizonAt(horizon, body.azDeg);
    const visible = body.elDeg + radiusDeg > horizonDeg;
    node.classList.toggle('hidden-body', !visible);
    const values = { name: t(nameKey), az: Math.round(body.azDeg), el: body.elDeg.toFixed(1) };
    // the horizon part is a span of its own so narrow screens can drop it (see scene.css)
    const part = (text, className) => el('span', className, text);
    if (expanded) {
      node.replaceChildren(
        part(t('sky.pos', values)),
        part(` · ${t('sky.hz', { horizon: horizonDeg.toFixed(1) })}`, 'scene-sky-hz'),
        part(` · ${t(visible ? 'sky.visible' : 'sky.hidden')}`),
      );
    } else {
      node.replaceChildren(
        part(t('sky.short', values), 'scene-sky-short'),
        part(` · ${t(visible ? 'sky.upShort' : 'sky.downShort')}`, 'scene-sky-state'),
      );
    }
  }

  function draw() {
    if (!last) return;
    const { site, sky } = last;
    const { bodies } = site.info;
    fillRow(sunRow, 'sky.sun', sky.sun, bodies.sun_radius_deg, site.horizon);
    fillRow(earthRow, 'sky.earth', sky.earth, bodies.earth_radius_deg, site.horizon);
    toggle.textContent = expanded ? '−' : '+';
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', t(expanded ? 'sky.collapse' : 'sky.expand'));
    toggle.title = t(expanded ? 'sky.collapse' : 'sky.expand');
    root.classList.toggle('expanded', expanded);
  }

  toggle.addEventListener('click', () => {
    expanded = !expanded;
    writeExpanded(expanded);
    draw();
  });

  return {
    el: root,
    update(site, sky) {
      last = { site, sky };
      draw();
    },
    setExpanded(on) {
      expanded = Boolean(on);
      draw();
    },
    isExpanded: () => expanded,
  };
}
