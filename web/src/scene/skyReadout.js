import { t } from '../i18n.js';
import { horizonAt } from '../metrics/visibility.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * The panel that says where the Sun and the Earth are (azimuth, elevation, the horizon of the terrain in
 * that direction and whether they are above it), for the site centre.
 * @returns {{el: HTMLElement, update(site: object, sky: {sun: object, earth: object}): void}}
 */
export function createSkyReadout() {
  const root = el('div', 'scene-sky');
  const sunRow = el('div', 'scene-sky-row scene-sky-sun');
  const earthRow = el('div', 'scene-sky-row scene-sky-earth');
  root.append(sunRow, earthRow);

  function fillRow(node, nameKey, body, radiusDeg, horizon) {
    const horizonDeg = horizonAt(horizon, body.azDeg);
    const visible = body.elDeg + radiusDeg > horizonDeg;
    node.classList.toggle('hidden-body', !visible);
    // the horizon part is a span of its own so narrow screens can drop it (see scene.css)
    const part = (text, className) => el('span', className, text);
    node.replaceChildren(
      part(t('sky.pos', { name: t(nameKey), az: Math.round(body.azDeg), el: body.elDeg.toFixed(1) })),
      part(` · ${t('sky.hz', { horizon: horizonDeg.toFixed(1) })}`, 'scene-sky-hz'),
      part(` · ${t(visible ? 'sky.visible' : 'sky.hidden')}`),
    );
  }

  return {
    el: root,
    update(site, sky) {
      const { bodies } = site.info;
      fillRow(sunRow, 'sky.sun', sky.sun, bodies.sun_radius_deg, site.horizon);
      fillRow(earthRow, 'sky.earth', sky.earth, bodies.earth_radius_deg, site.horizon);
    },
  };
}
