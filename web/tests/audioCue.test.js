import { afterEach, describe, expect, test } from 'vitest';
import { createAudioCue } from '../src/scene/audioCue.js';

class FakeAudioContext {
  static instances = [];

  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.oscillators = [];
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
