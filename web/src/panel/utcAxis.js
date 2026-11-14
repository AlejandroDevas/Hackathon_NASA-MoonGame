/**
 * uPlot `tzDate` option: formats time in UTC whatever the browser's time zone,
 * so the chart agrees with the UTC date field and the countdowns.
 * Returns a Date whose *local* getters show the UTC wall-clock time.
 * @param {number} tsSeconds Unix time in seconds
 */
export function utcTzDate(tsSeconds) {
  const date = new Date(tsSeconds * 1000);
  return new Date(date.getTime() + date.getTimezoneOffset() * 60_000);
}
