/** Device pixel ratio the 3D view starts with: sharp on 2x screens, capped because 3x costs more than it adds. */
export function initialPixelRatio(devicePixelRatio = 1, max = 2) {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(ratio, max);
}

/**
 * Lowers the render resolution when the view runs slowly, so a weak GPU (or software
 * rendering) trades sharpness for smoothness. It only ever goes down: going back up
 * could make it oscillate. Frames that last over `ignoreMs` (hidden tab, window being
 * dragged) are not counted.
 * @param {number} start the ratio to begin with
 * @param {{min?: number, step?: number, slowMs?: number, windowFrames?: number, ignoreMs?: number}} [options]
 * @returns {{record(frameMs: number): number|null, ratio(): number}} `record` returns the new ratio when it changed
 */
export function createPixelRatioGovernor(start, { min = 1, step = 0.25, slowMs = 40, windowFrames = 45, ignoreMs = 250 } = {}) {
  let ratio = start;
  let total = 0;
  let frames = 0;
  return {
    ratio: () => ratio,
    record(frameMs) {
      if (frameMs <= 0 || frameMs > ignoreMs || ratio <= min) return null;
      total += frameMs;
      frames += 1;
      if (frames < windowFrames) return null;
      const average = total / frames;
      total = 0;
      frames = 0;
      if (average <= slowMs) return null;
      ratio = Math.max(min, ratio - step);
      return ratio;
    },
  };
}
