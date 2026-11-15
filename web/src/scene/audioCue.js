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
};

/**
 * Small optional Web Audio cue. The AudioContext is created only after an explicit
 * user action (browsers block audio before that), and never if Web Audio is missing.
 * @param {{ AudioContextClass?: typeof AudioContext | null }} [options] injectable for tests
 */
export function createAudioCue({ AudioContextClass } = {}) {
  let context = null;
  let enabled = false;

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
    /** @param {string} [name] a key of CUES; the sign cue by default, silence for an unknown name */
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
    },
    dispose() {
      enabled = false;
      if (context && context.state !== 'closed') context.close();
      context = null;
    },
  };
}
