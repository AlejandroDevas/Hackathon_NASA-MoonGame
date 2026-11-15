import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createAmbientMusic } from '../src/scene/ambientMusic.js';

function param() {
  const p = {
    value: 0,
    calls: [],
    setValueAtTime(value, time) {
      p.calls.push(['set', value, time]);
      p.value = value;
    },
    linearRampToValueAtTime(value, time) {
      p.calls.push(['ramp', value, time]);
      p.value = value;
    },
    setTargetAtTime(value, time, constant) {
      p.calls.push(['target', value, time, constant]);
      p.value = value;
    },
    cancelScheduledValues() {},
  };
  return p;
}

function node(extra = {}) {
  const n = {
    connectedTo: [],
    connect(target) {
      n.connectedTo.push(target);
    },
    ...extra,
  };
  return n;
}

function makeContext() {
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    oscillators: [],
    gains: [],
    filters: [],
    convolvers: [],
    destination: {},
    createOscillator() {
      const o = node({ type: '', frequency: param(), detune: param(), start: (t) => (o.startAt = t), stop: (t) => (o.stopAt = t) });
      ctx.oscillators.push(o);
      return o;
    },
    createGain() {
      const g = node({ gain: param() });
      ctx.gains.push(g);
      return g;
    },
    createBiquadFilter() {
      const f = node({ type: '', frequency: param(), Q: param() });
      ctx.filters.push(f);
      return f;
    },
    createConvolver() {
      const c = node({ buffer: null });
      ctx.convolvers.push(c);
      return c;
    },
    createBuffer(channels, length, sampleRate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { length, sampleRate, getChannelData: (i) => data[i] };
    },
  };
  return ctx;
}

const freqOf = (o) => o.frequency.calls.find((c) => c[0] === 'set')[1];
const lastValue = (p) => p.calls[p.calls.length - 1][1];
const D4 = 293.6648;
const PENTATONIC = [0, 3, 5, 7, 10]; // D minor pentatonic, as semitones above D
const pitchClass = (hz) => (((Math.round(12 * Math.log2(hz / D4)) % 12) + 12) % 12);

let ctx;
let output;
beforeEach(() => {
  vi.useFakeTimers();
  ctx = makeContext();
  output = { name: 'output' };
});
afterEach(() => {
  vi.useRealTimers();
});

const make = (random = () => 0.5) => createAmbientMusic(ctx, output, { random });
const droneOscillators = () => ctx.oscillators.filter((o) => freqOf(o) < 200);
const noteOscillators = () => ctx.oscillators.filter((o) => freqOf(o) >= 200);
const musicGain = () => ctx.gains.find((g) => g.connectedTo.includes(output));
const cutoff = () => ctx.filters[0].frequency;

describe('createAmbientMusic', () => {
  test('creates no audio nodes until it is started', () => {
    make();
    expect(ctx.oscillators).toHaveLength(0);
    expect(ctx.gains).toHaveLength(0);
  });

  test('start() holds a low drone of two oscillators', () => {
    make().start();
    expect(droneOscillators()).toHaveLength(2);
    for (const o of droneOscillators()) expect(o.startAt).toBeDefined();
  });

  test('start() fades in from silence instead of cutting in', () => {
    make().start();
    const calls = musicGain().gain.calls;
    expect(calls[0].slice(0, 2)).toEqual(['set', 0]);
    expect(lastValue(musicGain().gain)).toBeGreaterThan(0);
  });

  test('starting while already running does not stack a second drone', () => {
    const music = make();
    music.start();
    music.start();
    expect(droneOscillators()).toHaveLength(2);
  });

  test('plays unhurried notes from the D minor pentatonic scale', () => {
    make().start();
    vi.advanceTimersByTime(20000);
    const notes = noteOscillators();
    expect(notes.length).toBeGreaterThanOrEqual(2);
    expect(notes.length).toBeLessThanOrEqual(5);
    for (const o of notes) expect(PENTATONIC).toContain(pitchClass(freqOf(o)));
  });

  test('notes vary with the random source', () => {
    let i = 0;
    const sequence = [0.05, 0.4, 0.8, 0.2, 0.95, 0.6, 0.3, 0.7, 0.1, 0.5];
    make(() => sequence[i++ % sequence.length]).start();
    vi.advanceTimersByTime(60000);
    const distinct = new Set(noteOscillators().map(freqOf));
    expect(distinct.size).toBeGreaterThan(2);
  });

  test('the filter opens as the Sun rises and is clamped at both ends', () => {
    const music = make();
    music.start();
    music.setSunElevation(-3);
    const low = lastValue(cutoff());
    music.setSunElevation(3);
    const high = lastValue(cutoff());
    expect(high).toBeGreaterThan(low);
    music.setSunElevation(40);
    expect(lastValue(cutoff())).toBe(high);
    music.setSunElevation(-40);
    expect(lastValue(cutoff())).toBe(low);
  });

  test('a Sun elevation given before start() is applied when it starts', () => {
    const music = make();
    music.setSunElevation(3);
    music.start();
    const bright = lastValue(cutoff());
    const dark = make();
    dark.setSunElevation(-3);
    ctx.oscillators.length = 0;
    ctx.filters.length = 0;
    dark.start();
    expect(bright).toBeGreaterThan(lastValue(cutoff()));
  });

  test('stop() fades out, silences the drone after the fade and plays no more notes', () => {
    const music = make();
    music.start();
    vi.advanceTimersByTime(7000);
    music.stop();
    expect(lastValue(musicGain().gain)).toBeLessThanOrEqual(0.001);
    for (const o of droneOscillators()) expect(o.stopAt).toBeGreaterThan(0);
    const before = ctx.oscillators.length;
    vi.advanceTimersByTime(60000);
    expect(ctx.oscillators).toHaveLength(before);
  });

  test('it can start again after stop()', () => {
    const music = make();
    music.start();
    music.stop();
    music.start();
    expect(droneOscillators()).toHaveLength(4); // the first pair plus a new one
    vi.advanceTimersByTime(20000);
    expect(noteOscillators().length).toBeGreaterThan(0);
  });

  test('stop() before start() and repeated stop() are harmless', () => {
    const music = make();
    expect(() => {
      music.stop();
      music.start();
      music.stop();
      music.stop();
    }).not.toThrow();
  });

  test('dispose() silences it like stop()', () => {
    const music = make();
    music.start();
    music.dispose();
    const before = ctx.oscillators.length;
    vi.advanceTimersByTime(60000);
    expect(ctx.oscillators).toHaveLength(before);
  });

  test('the reverb is a generated impulse, not a file', () => {
    make().start();
    const reverb = ctx.convolvers[0];
    expect(reverb.buffer).toBeTruthy();
    expect(reverb.buffer.getChannelData(0).some((v) => v !== 0)).toBe(true);
  });
});
