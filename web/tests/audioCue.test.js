import { afterEach, describe, expect, test } from 'vitest';
import { createAudioCue } from '../src/scene/audioCue.js';

class FakeAudioContext {
  static instances = [];

  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.oscillators = [];
    this.noiseSources = [];
    this.filters = [];
    this.buffersCreated = 0;
    this.sampleRate = 8000;
    this.closeCalls = 0;
    this.destination = {};
    FakeAudioContext.instances.push(this);
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  createOscillator() {
    const oscillator = {
      type: '',
      frequency: { setValueAtTime: (value) => (oscillator.frequencyHz = value) },
      connect() {},
      start() {},
      stop() {},
    };
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createBuffer(channels, length, sampleRate) {
    this.buffersCreated += 1;
    const data = new Float32Array(length);
    return { length, sampleRate, getChannelData: () => data };
  }

  createBufferSource() {
    const source = {
      buffer: null,
      connect() {},
      start: (when) => (source.startAt = when),
      stop: (when) => (source.stopAt = when),
    };
    this.noiseSources.push(source);
    return source;
  }

  createBiquadFilter() {
    const filter = { type: '', frequency: { setValueAtTime() {} }, Q: { setValueAtTime() {} }, connect() {} };
    this.filters.push(filter);
    return filter;
  }

  createGain() {
    return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
  }

  close() {
    this.closeCalls += 1;
    this.state = 'closed';
    return Promise.resolve();
  }
}

afterEach(() => {
  FakeAudioContext.instances = [];
});

describe('createAudioCue', () => {
  test('creates no AudioContext until the user enables it (autoplay policy)', () => {
    createAudioCue({ AudioContextClass: FakeAudioContext });
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  test('enabling builds one context and resumes it', () => {
    const cue = createAudioCue({ AudioContextClass: FakeAudioContext });
    expect(cue.setEnabled(true)).toBe(true);
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0].state).toBe('running');
  });

  test('play() sounds two notes, 660 Hz then 880 Hz', () => {
    const cue = createAudioCue({ AudioContextClass: FakeAudioContext });
    cue.setEnabled(true);
    cue.play();
    const notes = FakeAudioContext.instances[0].oscillators.map((o) => o.frequencyHz);
    expect(notes).toEqual([660, 880]);
  });

  test('play() is silent when disabled, never enabled, or the context is not running', () => {
    const never = createAudioCue({ AudioContextClass: FakeAudioContext });
    never.play();
    expect(FakeAudioContext.instances).toHaveLength(0);

    const cue = createAudioCue({ AudioContextClass: FakeAudioContext });
    cue.setEnabled(true);
    cue.setEnabled(false);
    cue.play();
    expect(FakeAudioContext.instances[0].oscillators).toHaveLength(0);

    cue.setEnabled(true);
    FakeAudioContext.instances[0].state = 'suspended';
    cue.play();
    expect(FakeAudioContext.instances[0].oscillators).toHaveLength(0);
  });

  test('muting and enabling again reuses the same context', () => {
    const cue = createAudioCue({ AudioContextClass: FakeAudioContext });
    cue.setEnabled(true);
    cue.setEnabled(false);
    cue.setEnabled(true);
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  test('without Web Audio the toggle reports off and play() does not throw', () => {
    const cue = createAudioCue({ AudioContextClass: null });
    expect(cue.setEnabled(true)).toBe(false);
    expect(() => cue.play()).not.toThrow();
  });

  test('a constructor that throws leaves the sound off instead of breaking the page', () => {
    class Broken {
      constructor() {
        throw new Error('not allowed');
      }
    }
    const cue = createAudioCue({ AudioContextClass: Broken });
    expect(cue.setEnabled(true)).toBe(false);
    expect(() => cue.play()).not.toThrow();
  });

  test('dispose closes the context once and is safe to repeat', () => {
    const cue = createAudioCue({ AudioContextClass: FakeAudioContext });
    cue.setEnabled(true);
    cue.dispose();
    cue.dispose();
    expect(FakeAudioContext.instances[0].closeCalls).toBe(1);
  });
});

describe('named cues', () => {
  const notesFor = (name) => {
    const cue = createAudioCue({ AudioContextClass: FakeAudioContext });
    cue.setEnabled(true);
    cue.play(name);
    return FakeAudioContext.instances[0].oscillators.map((o) => o.frequencyHz);
  };

  test('click is one short high tick', () => {
    expect(notesFor('click')).toEqual([1200]);
  });

  test('a green verdict climbs through three notes', () => {
    expect(notesFor('verdict-green')).toEqual([523.25, 659.25, 783.99]);
  });

  test('an amber verdict is two equal, neutral notes', () => {
    expect(notesFor('verdict-amber')).toEqual([440, 440]);
  });

  test('a red verdict falls through two low notes', () => {
    expect(notesFor('verdict-red')).toEqual([330, 247]);
  });

  test('an unknown cue name stays silent and does not throw', () => {
    expect(notesFor('does-not-exist')).toEqual([]);
  });

  test('named cues are silent while sound is off', () => {
    const cue = createAudioCue({ AudioContextClass: FakeAudioContext });
    cue.setEnabled(true);
    cue.setEnabled(false);
    cue.play('click');
    cue.play('verdict-green');
    expect(FakeAudioContext.instances[0].oscillators).toHaveLength(0);
  });
});

describe('radio cue (Quindar tones and static)', () => {
  const play = (name = 'radio') => {
    const cue = createAudioCue({ AudioContextClass: FakeAudioContext });
    cue.setEnabled(true);
    cue.play(name);
    return { cue, context: FakeAudioContext.instances[0] };
  };

  test('opens with the 2525 Hz intro tone and closes with the 2475 Hz outro tone', () => {
    const { context } = play();
    expect(context.oscillators.map((o) => o.frequencyHz)).toEqual([2525, 2475]);
  });

  test('a burst of static sits between the two tones', () => {
    const { context } = play();
    expect(context.noiseSources).toHaveLength(1);
    expect(context.noiseSources[0].startAt).toBeCloseTo(0.25);
    expect(context.noiseSources[0].stopAt).toBeCloseTo(0.85);
  });

  test('the static is band-limited like a radio channel', () => {
    const { context } = play();
    expect(context.filters.map((f) => f.type)).toEqual(['bandpass']);
  });

  test('the noise buffer holds real noise, not silence', () => {
    const { context } = play();
    const data = context.noiseSources[0].buffer.getChannelData(0);
    expect(data.some((v) => v !== 0)).toBe(true);
    expect(Math.max(...data)).toBeLessThanOrEqual(1);
    expect(Math.min(...data)).toBeGreaterThanOrEqual(-1);
  });

  test('the noise buffer is built once and reused by later plays', () => {
    const { cue, context } = play();
    cue.play('radio');
    expect(context.noiseSources).toHaveLength(2);
    expect(context.buffersCreated).toBe(1);
  });

  test('tone-only cues make no noise', () => {
    const { context } = play('click');
    expect(context.noiseSources).toHaveLength(0);
    expect(context.filters).toHaveLength(0);
  });

  test('is silent while sound is off', () => {
    const cue = createAudioCue({ AudioContextClass: FakeAudioContext });
    cue.setEnabled(true);
    cue.setEnabled(false);
    cue.play('radio');
    const context = FakeAudioContext.instances[0];
    expect(context.oscillators).toHaveLength(0);
    expect(context.noiseSources).toHaveLength(0);
  });
});
