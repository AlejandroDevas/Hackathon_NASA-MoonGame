import { clampTime } from '../panel/controls.js';
import { createPlayer } from '../panel/player.js';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Playback speeds: simulated time per real second. */
export const SPEEDS = [
  { key: 'speed.1h', ms: HOUR_MS },
  { key: 'speed.6h', ms: 6 * HOUR_MS },
  { key: 'speed.1d', ms: DAY_MS },
  { key: 'speed.7d', ms: 7 * DAY_MS },
  { key: 'speed.30d', ms: 30 * DAY_MS },
];
export const DEFAULT_SPEED_MS = SPEEDS[1].ms;

/** Steps of the skip buttons, in milliseconds. */
export const SKIPS = { hour: HOUR_MS, day: DAY_MS };

/**
 * The transport controls of the simulated time, like a video player: play and pause, a speed,
 * skipping by a fixed amount and jumping to any moment. Scenario A leads; if there is a scenario B it
 * moves by the same amount, so the gap between the two dates is kept (as the animation does).
 * @param {{get(): object, set(p: object): void, subscribe(fn: Function): () => void}} store
 * @param {Map<string, object>} sites
 */
export function createPlayback(store, sites) {
  let player = null;
  let speedMs = DEFAULT_SPEED_MS;

  const lastMs = (eph) => eph.startMs + (eph.count - 1) * eph.stepMs;

  /** Move every scenario by `deltaMs`, each one stopping at the ends of its own data. */
  function shiftBy(deltaMs) {
    const { scenarios } = store.get();
    const next = {};
    for (const slot of ['A', 'B']) {
      const scenario = scenarios[slot];
      next[slot] = scenario
        ? { ...scenario, timeMs: clampTime(sites.get(scenario.siteId).eph, scenario.timeMs + deltaMs).timeMs }
        : null;
    }
    store.set({ scenarios: next });
  }

  /** Jump scenario A to `timeMs` (clamped to its data) and move B along by the same amount. */
  function seekTo(timeMs) {
    const a = store.get().scenarios.A;
    const target = clampTime(sites.get(a.siteId).eph, timeMs).timeMs;
    if (target !== a.timeMs) shiftBy(target - a.timeMs);
  }

  function startPlayer() {
    player?.stop();
    player = createPlayer(store, sites, speedMs);
    player.start();
  }

  return {
    get speedMs() {
      return speedMs;
    },
    shiftBy,
    seekTo,
    /** Starts the animation; at the end of the data it starts again from the beginning, as a video does. */
    play() {
      const a = store.get().scenarios.A;
      const eph = sites.get(a.siteId).eph;
      if (a.timeMs >= lastMs(eph)) seekTo(eph.startMs);
      startPlayer();
    },
    pause() {
      player?.stop();
      if (store.get().playing) store.set({ playing: false });
    },
    toggle() {
      if (store.get().playing) this.pause();
      else this.play();
    },
    /** Changes the speed; a running animation continues at the new speed. */
    setSpeed(ms) {
      if (!SPEEDS.some((s) => s.ms === ms) || ms === speedMs) return;
      speedMs = ms;
      if (store.get().playing) startPlayer();
    },
  };
}
