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
    play() {
      if (!enabled || !context || context.state !== 'running') return;
      const now = context.currentTime;
      for (const [offset, frequency] of [[0, 660], [0.12, 880]]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, now + offset);
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.045, now + offset + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.22);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + 0.23);
      }
    },
    dispose() {
      enabled = false;
      if (context && context.state !== 'closed') context.close();
      context = null;
    },
  };
}
