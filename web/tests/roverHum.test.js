// @vitest-environment node
import { beforeEach, describe, expect, test } from 'vitest';
import { createRoverHum } from '../src/scene/roverHum.js';

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
    oscillators: [],
    gains: [],
    filters: [],
    destination: {},
    createOscillator() {
      const o = node({ type: '', frequency: param(), start: (t) => (o.startAt = t), stop: (t) => (o.stopAt = t) });
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
  };
  return ctx;
}

let ctx;
let output;
beforeEach(() => {
  ctx = makeContext();
  output = { name: 'output' };
});

const make = () => createRoverHum(ctx, output);
const level = () => ctx.gains.find((g) => g.connectedTo.includes(output)).gain; // the gain that reaches the output
const last = (p) => p.calls[p.calls.length - 1][1];
const pitch = () => ctx.oscillators[0].frequency;

describe('createRoverHum', () => {
  test('creates no audio nodes until it is started', () => {
    make();
    expect(ctx.oscillators).toHaveLength(0);
    expect(ctx.gains).toHaveLength(0);
  });

  test('start() builds a low motor tone of two oscillators', () => {
    make().start();
    expect(ctx.oscillators).toHaveLength(2);
    for (const o of ctx.oscillators) {
      expect(o.startAt).toBeDefined();
      expect(o.frequency.calls[0][1]).toBeLessThan(200);
    }
  });

  test('only the low rumble gets through, as it would through the chassis', () => {
    make().start();
    expect(ctx.filters).toHaveLength(1);
    expect(ctx.filters[0].type).toBe('lowpass');
    expect(ctx.filters[0].frequency.calls[0][1]).toBeLessThan(400);
  });

  test('it is silent at rest', () => {
    make().start();
    expect(last(level())).toBe(0);
  });

  test('it gets louder and higher with speed, and stays quiet overall', () => {
    const hum = make();
    hum.start();
    hum.setSpeed(0.3);
    const slow = last(level());
    const slowPitch = last(pitch());
    hum.setSpeed(1);
    expect(slow).toBeGreaterThan(0);
    expect(last(level())).toBeGreaterThan(slow);
    expect(last(level())).toBeLessThanOrEqual(0.2);
    expect(last(pitch())).toBeGreaterThan(slowPitch);
  });

  test('it falls silent again when the rover stops', () => {
    const hum = make();
    hum.start();
    hum.setSpeed(1);
    hum.setSpeed(0);
    expect(last(level())).toBe(0);
  });

  test('speed is clamped to 0..1 and non-numbers are ignored', () => {
    const hum = make();
    hum.start();
    hum.setSpeed(1);
    const top = last(level());
    hum.setSpeed(9);
    expect(last(level())).toBe(top);
    hum.setSpeed(0.5);
    const mid = last(level());
    hum.setSpeed(Number.NaN);
    expect(last(level())).toBe(mid);
    hum.setSpeed(-3);
    expect(last(level())).toBe(0);
  });

  test('negligible speed changes do not pile up scheduled events', () => {
    const hum = make();
    hum.start();
    hum.setSpeed(0.5);
    const before = level().calls.length;
    for (let i = 0; i < 50; i += 1) hum.setSpeed(0.5 + (i % 2) * 0.001);
    expect(level().calls.length).toBe(before);
  });

  test('a speed given before start() is used when it starts', () => {
    const hum = make();
    hum.setSpeed(1);
    hum.start();
    expect(last(level())).toBeGreaterThan(0);
  });

  test('starting while already running does not stack a second hum', () => {
    const hum = make();
    hum.start();
    hum.start();
    expect(ctx.oscillators).toHaveLength(2);
  });

  test('stop() fades to silence, then stops the oscillators', () => {
    const hum = make();
    hum.start();
    hum.setSpeed(1);
    hum.stop();
    expect(last(level())).toBe(0);
    for (const o of ctx.oscillators) expect(o.stopAt).toBeGreaterThan(0);
  });

  test('speed updates after stop() do nothing and do not throw', () => {
    const hum = make();
    hum.start();
    hum.stop();
    const events = level().calls.length;
    expect(() => hum.setSpeed(1)).not.toThrow();
    expect(level().calls.length).toBe(events);
  });

  test('it can start again after stop()', () => {
    const hum = make();
    hum.start();
    hum.stop();
    hum.start();
    expect(ctx.oscillators).toHaveLength(4);
  });

  test('stop() before start() and dispose() are harmless', () => {
    const hum = make();
    expect(() => {
      hum.stop();
      hum.dispose();
      hum.start();
      hum.dispose();
    }).not.toThrow();
  });
});
