/** Small optional Web Audio cue, created only after an explicit user action. */
export function createAudioCue() {
  let context = null;
  let enabled = false;

  return {
    setEnabled(next) {
      enabled = Boolean(next);
      if (!enabled) return false;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        enabled = false;
        return false;
      }
      context ??= new AudioContextClass();
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
