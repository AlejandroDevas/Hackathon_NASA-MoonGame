// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mayPreload, startTerrainPreload } from '../src/data/preload.js';

const site = (terrain = true) => ({ info: terrain ? { terrain: { file: 't.bin' } } : {}, terrain: null });
const sites = () =>
  new Map([
    ['first', site()],
    ['a', site()],
    ['b', site()],
    ['none', site(false)],
    ['c', site()],
  ]);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('mayPreload', () => {
  test('yes by default, no when the visitor saves data or the connection is slow', () => {
    expect(mayPreload(undefined)).toBe(true);
    expect(mayPreload({ effectiveType: '4g' })).toBe(true);
    expect(mayPreload({ saveData: true })).toBe(false);
    for (const type of ['slow-2g', '2g', '3g']) expect(mayPreload({ effectiveType: type })).toBe(false);
  });
});

describe('startTerrainPreload', () => {
  const now = (cb) => {
    cb();
    return () => {};
  };

  test('fetches the other sites one at a time, after a pause, skipping the one on screen and those without terrain', async () => {
    const all = sites();
    const order = [];
    let inFlight = 0;
    let most = 0;
    const ensure = async (s) => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      order.push([...all.entries()].find(([, v]) => v === s)[0]);
      await Promise.resolve();
      inFlight -= 1;
    };
    startTerrainPreload(all, 'first', { ensure, schedule: now, delayMs: 1000 });
    await vi.advanceTimersByTimeAsync(500);
    expect(order).toEqual([]); // not yet: the page gets the first seconds to itself
    await vi.advanceTimersByTimeAsync(600);
    expect(order).toEqual(['a', 'b', 'c']);
    expect(most).toBe(1);
  });

  test('does nothing on a connection that saves data or is slow', async () => {
    const ensure = vi.fn();
    startTerrainPreload(sites(), 'first', { ensure, schedule: now, delayMs: 0, connection: { saveData: true } });
    await vi.advanceTimersByTimeAsync(5000);
    expect(ensure).not.toHaveBeenCalled();
  });

  test('a failure does not stop the rest, and stopping it stops the queue', async () => {
    const calls = [];
    let stop;
    const ensure = async (s) => {
      calls.push(s);
      if (calls.length === 1) throw new Error('offline');
      if (calls.length === 2) stop();
    };
    stop = startTerrainPreload(sites(), 'first', { ensure, schedule: now, delayMs: 0 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(2); // the failed one, then one more, then stopped before the third
  });

  test('skips a site that loaded in the meantime, by being asked for', async () => {
    const all = sites();
    all.get('a').terrain = {}; // chosen by hand before the preload began
    const ensure = vi.fn(async () => {});
    startTerrainPreload(all, 'first', { ensure, schedule: now, delayMs: 0 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(ensure).toHaveBeenCalledTimes(2); // b and c
  });
});
