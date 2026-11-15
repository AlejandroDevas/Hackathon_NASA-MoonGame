/**
 * Notes of each cue as [start offset s, frequency Hz, length s, peak gain]. Everything is synthesized,
 * so there are no audio files to ship or license. Short, quiet and sine-only on purpose.
 */
const CUES = {
  sign: [[0, 660, 0.23, 0.045], [0.12, 880, 0.23, 0.045]], // the sign opens at the lander
  click: [[0, 1200, 0.06, 0.03]], // a toolbar button or select was used
  'verdict-green': [[0, 523.25, 0.2, 0.04], [0.1, 659.25, 0.2, 0.04], [0.2, 783.99, 0.3, 0.04]], // C5 E5 G5
  'verdict-amber': [[0, 440, 0.16, 0.04], [0.18, 440, 0.16, 0.04]], // A4 twice
  'verdict-red': [[0, 330, 0.2, 0.045], [0.18, 247, 0.34, 0.045]], // E4 then B3, falling
  // Apollo-style radio call: Quindar intro tone (2525 Hz), static, outro tone (2475 Hz), 250 ms each.
  radio: [[0, 2525, 0.25, 0.03], [0.85, 2475, 0.25, 0.03]],
};

/** Bands of static of each cue as [start offset s, length s, peak gain, band-pass centre Hz]. */
const NOISE = {
  radio: [[0.25, 0.6, 0.02, 1800]],
};

/**
 * Small optional Web Audio cue. The AudioContext is created only after an explicit
 * user action (browsers block audio before that), and never if Web Audio is missing.
 * @param {{ AudioContextClass?: typeof AudioContext | null }} [options] injectable for tests
 */
export function createAudioCue({ AudioContextClass } = {}) {
  let context = null;
  let enabled = false;
  let noiseBuffer = null; // one second of white noise, built on first use and reused

  function getNoiseBuffer() {
    if (!noiseBuffer) {
      noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  function playNoise(now, [offset, length, peak, centreHz]) {
    const source = context.createBufferSource();
    source.buffer = getNoiseBuffer();
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(centreHz, now);
    filter.Q.setValueAtTime(0.7, now);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(peak, now + offset + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + length - 0.01);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start(now + offset);
    source.stop(now + offset + length);
  }

  return {
    setEnabled(next) {
      enabled = Boolean(next);
      if (!enabled) return false;

      const ContextClass =
        AudioContextClass === undefined ? window.AudioContext || window.webkitAudioContext : AudioContextClass;
      if (!ContextClass) {
        enabled = false;
        return false;
      }
      try {
        context ??= new ContextClass();
      } catch {
        enabled = false; // e.g. the browser refuses to create a context: stay silent instead of breaking the page
        return false;
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
      return enabled;
    },
    /** @param {string} [name] a key of CUES (and optionally NOISE); the sign cue by default, silence for an unknown name */
    play(name = 'sign') {
      const notes = CUES[name];
      if (!notes || !enabled || !context || context.state !== 'running') return;
      const now = context.currentTime;
      for (const [offset, frequency, length, peak] of notes) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, now + offset);
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(peak, now + offset + Math.min(0.025, length / 4));
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + length - 0.01);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + length);
      }
      for (const band of NOISE[name] ?? []) playNoise(now, band);
    },
    dispose() {
      enabled = false;
      if (context && context.state !== 'closed') context.close();
      context = null;
      noiseBuffer = null;
    },
  };
}
