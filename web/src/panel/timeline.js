import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { timelineData } from './timelineData.js';
import { utcTzDate } from './utcAxis.js';
import { t } from '../i18n.js';

const SUN = '#ffc857';
const EARTH = '#5aa9ff';

/**
 * Draw the chart into `el` with a vertical cursor at `cursorMs`.
 * @returns {{destroy(): void, setCursor(ms: number): void}}
 */
export function renderTimeline(el, site, fromMs, toMs, cursorMs) {
  let cursor = cursorMs;
  const axis = { stroke: '#98a2b8', grid: { stroke: '#2a3242', width: 1 }, ticks: { stroke: '#2a3242' } };
  const plot = new uPlot(
    {
      width: Math.max(el.clientWidth, 240),
      height: 220,
      legend: { show: true },
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
            u.ctx.strokeStyle = '#e8ebf2';
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
    timelineData(site, fromMs, toMs),
    el,
  );
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
      plot.destroy();
    },
    setCursor(ms) {
      cursor = ms;
      plot.redraw(false);
    },
  };
}
