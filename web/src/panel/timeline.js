import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { createScrubber } from './scrub.js';
import { timelineData } from './timelineData.js';
import { utcTzDate } from './utcAxis.js';
import { t } from '../i18n.js';

const SUN = '#d4ad5b';
const EARTH = '#e5e0d5';

/**
 * Draw the chart into `el` with a vertical cursor at `cursorMs`. With `onScrub`, dragging on the
 * plot (or the arrow keys, using `getTime`) asks to move the time; uPlot's own drag-zoom is off.
 * @param {{onScrub?: (ms: number) => void, getTime?: () => number}} [scrub]
 * @returns {{destroy(): void, setCursor(ms: number): void}}
 */
export function renderTimeline(el, site, fromMs, toMs, cursorMs, { onScrub, getTime } = {}) {
  let cursor = cursorMs;
  const data = timelineData(site, fromMs, toMs);
  const firstMs = data[0][0] * 1000;
  const lastMs = data[0][data[0].length - 1] * 1000;
  const axis = { stroke: '#aaa69b', grid: { stroke: '#393731', width: 1 }, ticks: { stroke: '#393731' } };
  const plot = new uPlot(
    {
      width: Math.max(el.clientWidth, 240),
      height: 220,
      legend: { show: true },
      cursor: { drag: { x: false, y: false } }, // dragging scrubs the time instead of zooming
      scales: { x: { time: true } },
      tzDate: utcTzDate,
      axes: [{ ...axis, label: t('chart.utc') }, { ...axis, label: t('chart.elevation') }],
      series: [
        {},
        { label: t('card.sunEl'), stroke: SUN, width: 2 },
        { label: `${t('card.sunEl')} · ${t('chart.horizon')}`, stroke: SUN, width: 1, dash: [5, 4] },
        { label: t('card.earthEl'), stroke: EARTH, width: 2 },
        { label: `${t('card.earthEl')} · ${t('chart.horizon')}`, stroke: EARTH, width: 1, dash: [5, 4] },
      ],
      hooks: {
        draw: [
          (u) => {
            const x = u.valToPos(cursor / 1000, 'x', true);
            if (x < u.bbox.left || x > u.bbox.left + u.bbox.width) return;
            u.ctx.save();
            u.ctx.strokeStyle = '#f4f1e9';
            u.ctx.lineWidth = 1.5;
            u.ctx.beginPath();
            u.ctx.moveTo(x, u.bbox.top);
            u.ctx.lineTo(x, u.bbox.top + u.bbox.height);
            u.ctx.stroke();
            u.ctx.restore();
          },
        ],
      },
    },
    data,
    el,
  );
  // uPlot has no scale yet while the chart is being built, so fall back to the data range
  const rangeMs = () => ({
    fromMs: plot.scales.x.min != null ? plot.scales.x.min * 1000 : firstMs,
    toMs: plot.scales.x.max != null ? plot.scales.x.max * 1000 : lastMs,
  });
  const describeTime = (ms) => {
    plot.over.setAttribute('aria-valuenow', String(Math.round(ms / 1000)));
    plot.over.setAttribute('aria-valuetext', `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`);
  };
  const scrubber = onScrub
    ? createScrubber({ element: plot.over, getRange: rangeMs, getTime: getTime ?? (() => cursor), onScrub })
    : null;
  if (scrubber) {
    const { fromMs: min, toMs: max } = rangeMs();
    plot.over.setAttribute('aria-valuemin', String(Math.round(min / 1000)));
    plot.over.setAttribute('aria-valuemax', String(Math.round(max / 1000)));
    describeTime(cursor);
  }
  let lastWidth = el.clientWidth;
  const observer = typeof ResizeObserver === 'function'
    ? new ResizeObserver(([entry]) => {
      const width = Math.max(Math.floor(entry.contentRect.width), 240);
      if (width === lastWidth) return;
      lastWidth = width;
      plot.setSize({ width, height: 220 });
    })
    : null;
  observer?.observe(el);
  return {
    destroy() {
      observer?.disconnect();
      scrubber?.dispose();
      plot.destroy();
    },
    setCursor(ms) {
      cursor = ms;
      if (scrubber) describeTime(ms);
      plot.redraw(false);
    },
  };
}
