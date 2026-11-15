/**
 * A low motor hum that follows the rover's speed. There is no air on the Moon, so this is not a
 * sound of the landscape: it is what an astronaut would hear through the rover's own chassis,
 * which is why only a muffled, low rumble gets through (a low-pass filter) and it is silent at rest.
 * Built with Web Audio, no audio files.
 *
 * @param {AudioContext} context
 * @param {AudioNode} output where the hum is sent (the cue's master volume)
 */

const BASE_HZ = 45;
const SPEED_HZ = 40; // extra pitch at full speed
const PEAK = 0.12; // gain at full speed: quiet, it sits under the music
const CUTOFF_HZ = 220;
const SMOOTH_S = 0.15; // time constant so frame-to-frame speed noise does not flutter the sound
const MIN_STEP = 0.02; // changes smaller than this are ignored, to keep the automation timeline short
const FADE_OUT_TAU_S = 0.2;
const FADE_OUT_TOTAL_S = 1.2;

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function createRoverHum(context, output) {
  let running = false;
  let graph = null;
  let speed = 0; // last speed accepted, 0..1
  let applied = null; // speed last sent to the audio graph

  /** Perceptual curve: a slow rover is still clearly audible. */
  const levelFor = (s) => (s <= 0 ? 0 : PEAK * Math.sqrt(s));
  const pitchFor = (s) => BASE_HZ + SPEED_HZ * s;

  function apply(now, initial) {
    const { level, saw, sine } = graph;
    if (initial) {
      level.gain.setValueAtTime(levelFor(speed), now);
      saw.frequency.setValueAtTime(pitchFor(speed), now);
      sine.frequency.setValueAtTime(pitchFor(speed) * 2, now);
    } else {
      level.gain.setTargetAtTime(levelFor(speed), now, SMOOTH_S);
      saw.frequency.setTargetAtTime(pitchFor(speed), now, SMOOTH_S);
      sine.frequency.setTargetAtTime(pitchFor(speed) * 2, now, SMOOTH_S);
    }
    applied = speed;
  }

  function start() {
    if (running) return;
    running = true;
    const now = context.currentTime;

    const level = context.createGain();
    level.connect(output);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(CUTOFF_HZ, now);
    filter.Q.setValueAtTime(0.7, now);
    filter.connect(level);

    const saw = context.createOscillator();
    saw.type = 'sawtooth';
    saw.connect(filter);
    const sine = context.createOscillator(); // an octave up, softer, to give the motor some body
    sine.type = 'sine';
    const sineWeight = context.createGain();
    sineWeight.gain.setValueAtTime(0.4, now);
    sine.connect(sineWeight);
    sineWeight.connect(filter);

    graph = { level, saw, sine };
    apply(now, true);
    saw.start(now);
    sine.start(now);
  }

  function stop() {
    if (!running) return;
    running = false;
    const { level, saw, sine } = graph;
    const now = context.currentTime;
    level.gain.setTargetAtTime(0, now, FADE_OUT_TAU_S);
    level.gain.setValueAtTime(0, now + FADE_OUT_TOTAL_S);
    saw.stop(now + FADE_OUT_TOTAL_S);
    sine.stop(now + FADE_OUT_TOTAL_S);
    graph = null;
    applied = null;
  }

  return {
    start,
    stop,
    /** @param {number} next rover speed as a fraction of its boosted top speed, 0..1 */
    setSpeed(next) {
      const value = Number(next);
      if (!Number.isFinite(value)) return;
      speed = clamp01(value);
      if (!running) return;
      // Always send a stop, otherwise skip changes too small to hear.
      if (speed === 0 ? applied !== 0 : Math.abs(speed - applied) >= MIN_STEP) apply(context.currentTime, false);
    },
    dispose: stop,
  };
}
