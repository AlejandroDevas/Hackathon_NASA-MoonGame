import { t } from '../i18n.js';

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const wrap360 = (deg) => ((deg % 360) + 360) % 360;

/** Compass bearing (0 = north, 90 = east) of the direction (dx east, dz south) in scene coordinates. */
export function bearingDeg(dx, dz) {
  return wrap360((Math.atan2(dx, -dz) * 180) / Math.PI);
}

/** The signed angle (-180..180] to turn from the bearing `from` to the bearing `to`; positive turns right. */
export function turnDeg(from, to) {
  const d = wrap360(to - from);
  return d > 180 ? d - 360 : d;
}

/** Which of the eight compass sectors ('N', 'NE', ...) a bearing falls in. */
export function sectorOf(deg) {
  return SECTORS[Math.round(wrap360(deg) / 45) % 8];
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * A small strip at the top of the view: which way the camera looks (a compass letter and the bearing) and an
 * arrow that points to the landing zone, with its distance, so the objective is never lost off screen.
 * It is decoration for sighted drivers; the landmarks have their own text list for screen readers.
 * @param {HTMLElement} hud
 */
export function createCompass(hud) {
  const root = el('div', 'scene-compass');
  root.setAttribute('aria-hidden', 'true');
  const heading = el('span', 'scene-compass-heading');
  const goal = el('span', 'scene-compass-goal');
  const arrow = el('span', 'scene-compass-arrow');
  const goalName = el('span', 'scene-compass-goal-name'); // dropped on a narrow screen: the arrow and the metres say it
  const goalDist = el('span', 'scene-compass-goal-dist');
  const goalText = el('span', 'scene-compass-goal-text');
  goalText.append(goalName, goalDist);
  goal.append(arrow, goalText);
  root.append(heading, goal);
  hud.append(root);
  let shown = { heading: null, turn: null, dist: null };

  return {
    el: root,
    /**
     * @param {number} yawDeg bearing the camera looks along
     * @param {{x: number, z: number}} robot
     * @param {{x: number, z: number}|null} target the landing zone (null hides the arrow)
     * @param {boolean} [hidden] true once the rover has arrived and the sign is open
     */
    update(yawDeg, robot, target, hidden = false) {
      root.hidden = hidden;
      if (hidden) return;
      const bearing = Math.round(wrap360(yawDeg));
      if (bearing !== shown.heading) {
        shown.heading = bearing;
        heading.textContent = `${t(`compass.short.${sectorOf(bearing)}`)} ${String(bearing).padStart(3, '0')}°`;
      }
      goal.hidden = !target;
      if (!target) return;
      const dx = target.x - robot.x;
      const dz = target.z - robot.z;
      const turn = Math.round(turnDeg(yawDeg, bearingDeg(dx, dz)));
      const dist = Math.round(Math.hypot(dx, dz));
      if (turn !== shown.turn) {
        shown.turn = turn;
        arrow.style.transform = `rotate(${turn - 90}deg)`; // the glyph points right at 0
        arrow.dataset.turn = String(turn);
      }
      if (dist !== shown.dist) {
        shown.dist = dist;
        goalName.textContent = `${t('poi.goal')} · `;
        goalDist.textContent = t('compass.dist', { dist });
      }
    },
    /** Draw the texts again (the language changed). */
    refreshTexts() {
      shown = { heading: null, turn: null, dist: null };
    },
  };
}
