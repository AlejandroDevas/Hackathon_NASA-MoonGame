// @vitest-environment node
import { afterEach, describe, expect, test } from 'vitest';
import { createAudioCue } from '../src/scene/audioCue.js';

class FakeAudioContext {
  static instances = [];

  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.oscillators = [];
    this.gains = [];
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
    const g = {
      gain: {
        last: undefined,
        setValueAtTime: (value) => (g.gain.last = value),
        exponentialRampToValueAtTime() {},
        setTargetAtTime: (value) => (g.gain.last = value),
      },
      connectedTo: [],
      connect: (target) => g.connectedTo.push(target),
    };
    this.gains.push(g);
    return g;
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

describe('master volume', () => {
  const enabled = (options = {}) => {
    const cue = createAudioCue({ AudioContextClass: FakeAudioContext, ...options });
    cue.setEnabled(true);
    return { cue, context: FakeAudioContext.instances[0] };
  };
  const masterOf = (context) => context.gains.find((g) => g.connectedTo.includes(context.destination));

  test('there is one master gain into the speakers, at 0.6 by default', () => {
    const { context } = enabled();
    expect(masterOf(context).gain.last).toBe(0.6);
  });

  test('cues go through the master gain, never straight to the speakers', () => {
    const { cue, context } = enabled();
    cue.play('click');
    cue.play('radio');
    const master = masterOf(context);
    const others = context.gains.filter((g) => g !== master);
    expect(others.length).toBeGreaterThan(0);
    for (const g of others) {
      expect(g.connectedTo).toContain(master);
      expect(g.connectedTo).not.toContain(context.destination);
    }
  });

  test('setVolume changes the master gain and clamps to 0..1', () => {
    const { cue, context } = enabled();
    cue.setVolume(0.3);
    expect(masterOf(context).gain.last).toBe(0.3);
    cue.setVolume(5);
    expect(masterOf(context).gain.last).toBe(1);
    cue.setVolume(-1);
    expect(masterOf(context).gain.last).toBe(0);
  });

  test('a volume chosen before sound is enabled is used when the context is built', () => {
    const cue = createAudioCue({ AudioContextClass: FakeAudioContext });
    cue.setVolume(0.25);
    cue.setEnabled(true);
    expect(masterOf(FakeAudioContext.instances[0]).gain.last).toBe(0.25);
  });

  test('setVolume ignores values that are not numbers', () => {
    const { cue, context } = enabled();
    cue.setVolume(0.4);
    cue.setVolume(Number.NaN);
    expect(masterOf(context).gain.last).toBe(0.4);
  });
});

describe('ambient music lifecycle', () => {
  function spyMusic() {
    const music = { calls: [], created: [] };
    music.factory = (context, output) => {
      music.created.push({ context, output });
      return {
        start: () => music.calls.push('start'),
        stop: () => music.calls.push('stop'),
        setSunElevation: (deg) => music.calls.push(['sun', deg]),
        dispose: () => music.calls.push('dispose'),
      };
    };
    return music;
  }

  test('no music is made unless a factory is given', () => {
    const cue = createAudioCue({ AudioContextClass: FakeAudioContext });
    expect(() => {
      cue.setEnabled(true);
      cue.setSunElevation(1);
      cue.setEnabled(false);
    }).not.toThrow();
  });

  test('music is created only when sound is enabled, and is fed by the master gain', () => {
    const music = spyMusic();
    const cue = createAudioCue({ AudioContextClass: FakeAudioContext, createMusic: music.factory });
    expect(music.created).toHaveLength(0);
    cue.setEnabled(true);
    const context = FakeAudioContext.instances[0];
    expect(music.created).toHaveLength(1);
    expect(music.created[0].context).toBe(context);
    expect(music.created[0].output.connectedTo).toContain(context.destination);
    expect(music.calls).toEqual(['start']);
  });

  test('muting stops the music and enabling again restarts the same instance', () => {
    const music = spyMusic();
    const cue = createAudioCue({ AudioContextClass: FakeAudioContext, createMusic: music.factory });
    cue.setEnabled(true);
    cue.setEnabled(false);
    cue.setEnabled(true);
    expect(music.created).toHaveLength(1);
    expect(music.calls).toEqual(['start', 'stop', 'start']);
  });

  test('the Sun elevation is forwarded, including one given before the music exists', () => {
    const music = spyMusic();
    const cue = createAudioCue({ AudioContextClass: FakeAudioContext, createMusic: music.factory });
    cue.setSunElevation(2);
    cue.setEnabled(true);
    cue.setSunElevation(-1);
    expect(music.calls).toEqual([['sun', 2], 'start', ['sun', -1]]);
  });

  test('dispose disposes the music', () => {
    const music = spyMusic();
    const cue = createAudioCue({ AudioContextClass: FakeAudioContext, createMusic: music.factory });
    cue.setEnabled(true);
    cue.dispose();
    expect(music.calls).toContain('dispose');
  });

  test('music that fails to build leaves the sound off instead of breaking the page', () => {
    const cue = createAudioCue({
      AudioContextClass: FakeAudioContext,
      createMusic: () => {
        throw new Error('boom');
      },
    });
    expect(cue.setEnabled(true)).toBe(false);
  });
});

describe('rover hum lifecycle', () => {
  function spyHum() {
    const hum = { calls: [], created: [] };
    hum.factory = (context, output) => {
      hum.created.push({ context, output });
      return {
        start: () => hum.calls.push('start'),
        stop: () => hum.calls.push('stop'),
        setSpeed: (v) => hum.calls.push(['speed', v]),
        dispose: () => hum.calls.push('dispose'),
      };
    };
    return hum;
  }
  const build = (hum) => createAudioCue({ AudioContextClass: FakeAudioContext, createHum: hum.factory });

  test('no hum is made unless a factory is given', () => {
    const cue = createAudioCue({ AudioContextClass: FakeAudioContext });
    expect(() => {
      cue.setEnabled(true);
      cue.setRoverSpeed(0.5);
      cue.setEnabled(false);
    }).not.toThrow();
  });

  test('the hum exists only once sound is enabled, and is fed by the master gain', () => {
    const hum = spyHum();
    const cue = build(hum);
    expect(hum.created).toHaveLength(0);
    cue.setEnabled(true);
    const context = FakeAudioContext.instances[0];
    expect(hum.created).toHaveLength(1);
    expect(hum.created[0].output.connectedTo).toContain(context.destination);
    expect(hum.calls).toEqual(['start']);
  });

  test('muting stops the hum and enabling again restarts the same instance', () => {
    const hum = spyHum();
    const cue = build(hum);
    cue.setEnabled(true);
    cue.setEnabled(false);
    cue.setEnabled(true);
    expect(hum.created).toHaveLength(1);
    expect(hum.calls).toEqual(['start', 'stop', 'start']);
  });

  test('the rover speed is forwarded, including one given before the hum exists', () => {
    const hum = spyHum();
    const cue = build(hum);
    cue.setRoverSpeed(0.4);
    cue.setEnabled(true);
    cue.setRoverSpeed(0.9);
    expect(hum.calls).toEqual([['speed', 0.4], 'start', ['speed', 0.9]]);
  });

  test('dispose disposes the hum', () => {
    const hum = spyHum();
    const cue = build(hum);
    cue.setEnabled(true);
    cue.dispose();
    expect(hum.calls).toContain('dispose');
  });
});
