/** Render scales the controller steps through, from full resolution down to a quarter of the pixels. */
export const SCALES = [1, 0.85, 0.7, 0.6, 0.5];
/** Frames longer than this are tab switches or one-off hitches, not a sign of load. */
const OUTLIER_MS = 250;

/**
 * Keeps the 3D view smooth on slow machines by lowering the render resolution when frames take
 * too long, and raising it again only after a while at a good frame rate. It never changes anything
 * else, and it backs off (waits longer to try again) if raising the resolution brings the slowness back.
 *
 * Feed it the time between two consecutive rendered frames; it answers with the new scale when it
 * decides to change, else null.
 * @param {{slowMs?: number, fastMs?: number, window?: number, holdMs?: number, maxHoldMs?: number}} [options]
 */
export function createQualityController({ slowMs = 24, fastMs = 18, window = 40, holdMs = 6000, maxHoldMs = 60_000 } = {}) {
  let step = 0;
  let samples = [];
  let hold = holdMs;
  let lastChangeAt = -Infinity;
  let lastRaiseAt = -Infinity;

  return {
    get scale() {
      return SCALES[step];
    },
    /**
     * @param {number} frameMs milliseconds since the previous rendered frame
     * @param {number} nowMs current time, from any monotonic clock
     * @returns {number|null} the new scale if it changed
     */
    record(frameMs, nowMs) {
      if (!(frameMs > 0) || frameMs > OUTLIER_MS) return null;
      samples.push(frameMs);
      if (samples.length < window) return null;
      const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
      samples = [];
      if (mean > slowMs && step < SCALES.length - 1) {
        // lowering right after a raise means the raise was too ambitious: wait longer next time
        if (nowMs - lastRaiseAt < 2 * hold) hold = Math.min(hold * 2, maxHoldMs);
        step++;
        lastChangeAt = nowMs;
        return SCALES[step];
      }
      if (mean < fastMs && step > 0 && nowMs - lastChangeAt >= hold) {
        step--;
        lastChangeAt = nowMs;
        lastRaiseAt = nowMs;
        return SCALES[step];
      }
      return null;
    },
  };
}

/** The graphics quality choices: Auto lets the controller above decide; the others pin the render scale. */
export const QUALITY_MODES = ['auto', 'high', 'medium', 'low'];
const MODE_SCALE = { high: 1, medium: 0.7, low: 0.5 };

/** The render scale to use: the pinned one for High/Medium/Low, the controller's for Auto (or anything unknown). */
export function renderScaleFor(mode, autoScale) {
  return MODE_SCALE[mode] ?? autoScale;
}

/** The next choice when the menu item is pressed: Auto, High, Medium, Low, and back to Auto. */
export function nextQualityMode(mode) {
  const index = QUALITY_MODES.indexOf(mode);
  return QUALITY_MODES[(index + 1) % QUALITY_MODES.length];
}
