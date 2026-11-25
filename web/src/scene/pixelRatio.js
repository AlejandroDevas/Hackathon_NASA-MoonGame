/** Device pixel ratio the 3D view starts with: sharp on 2x screens, capped because 3x costs more than it adds. */
export function initialPixelRatio(devicePixelRatio = 1, max = 2) {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(ratio, max);
}
