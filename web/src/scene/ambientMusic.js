/**
 * Generative ambient soundtrack, built entirely with Web Audio (no audio files to ship or license).
 *
 * A low D + A drone holds the floor; every few seconds one long, soft note from the D minor
 * pentatonic scale swells in and fades away; everything goes through a low-pass filter and a
 * synthetic reverb. The filter opens with the Sun's elevation, so the music brightens as the light
 * rises and darkens toward the lunar night. It is a non-diegetic soundtrack, not a sound of the
 * Moon (there is no air to carry one).
 *
 * @param {AudioContext} context
 * @param {AudioNode} output where the music is sent (the cue's master volume)
 * @param {{ random?: () => number }} [options] injectable so tests are deterministic
 */

const D4 = 293.6648;
const SCALE = [0, 3, 5, 7, 10]; // D minor pentatonic, in semitones above D
const LEVEL = 0.2; // music bus gain once faded in
const FADE_IN_S = 3;
const FADE_OUT_TAU_S = 0.5;
const FADE_OUT_TOTAL_S = 3; // six time constants: effectively silent
const NOTE_ATTACK_S = 2;
const NOTE_RELEASE_S = 5;
const NOTE_PEAK = 0.15;
const SUN_RANGE_DEG = [-3, 3]; // the Sun hugs the horizon at the poles, so a narrow range moves the sound
const CUTOFF_RANGE_HZ = [200, 1600];

const semitones = (n) => D4 * 2 ** (n / 12);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function createAmbientMusic(context, output, { random = Math.random } = {}) {
  let running = false;
  let graph = null; // nodes of the current run
  let timer = null;
  let brightness = 0.5; // 0 = Sun far below the horizon, 1 = well above it
  let impulse = null;

  const cutoffHz = () => CUTOFF_RANGE_HZ[0] * (CUTOFF_RANGE_HZ[1] / CUTOFF_RANGE_HZ[0]) ** brightness;

  function reverbImpulse() {
    if (!impulse) {
      const length = Math.floor(context.sampleRate * 3);
      impulse = context.createBuffer(2, length, context.sampleRate);
      for (let channel = 0; channel < 2; channel += 1) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
      }
    }
    return impulse;
  }

  function drone(frequency, type, detuneCents, destination, now) {
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.detune.setValueAtTime(detuneCents, now);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.25, now);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(now);
    return oscillator;
  }

  function scheduleNote() {
    const now = context.currentTime;
    const degree = SCALE[Math.floor(random() * SCALE.length)];
    const octave = random() < 0.5 ? 0 : 12;
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(semitones(degree + octave), now);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(NOTE_PEAK, now + NOTE_ATTACK_S);
    gain.gain.linearRampToValueAtTime(0, now + NOTE_ATTACK_S + NOTE_RELEASE_S);
    oscillator.connect(gain);
    gain.connect(graph.filter);
    oscillator.start(now);
    oscillator.stop(now + NOTE_ATTACK_S + NOTE_RELEASE_S + 0.1);
  }

  function scheduleNext() {
    const waitMs = (4 + random() * 4) * 1000;
    timer = setTimeout(() => {
      if (!running) return;
      scheduleNote();
      scheduleNext();
    }, waitMs);
  }

  function start() {
    if (running) return;
    running = true;
    const now = context.currentTime;

    const bus = context.createGain();
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(LEVEL, now + FADE_IN_S);
    bus.connect(output);

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz(), now);
    filter.Q.setValueAtTime(0.5, now);

    const dry = context.createGain();
    dry.gain.setValueAtTime(0.7, now);
    const reverb = context.createConvolver();
    reverb.buffer = reverbImpulse();
    const wet = context.createGain();
    wet.gain.setValueAtTime(0.6, now);
    filter.connect(dry);
    filter.connect(reverb);
    reverb.connect(wet);
    dry.connect(bus);
    wet.connect(bus);

    graph = {
      bus,
      filter,
      drones: [
        drone(semitones(-24), 'sine', 0, filter, now), // D2
        drone(semitones(-17), 'triangle', 4, filter, now), // A2, a few cents sharp so it slowly beats
      ],
    };
    scheduleNext();
  }

  function stop() {
    if (!running) return;
    running = false;
    clearTimeout(timer);
    timer = null;
    const { bus, drones } = graph;
    const now = context.currentTime;
    if (bus.gain.cancelAndHoldAtTime) bus.gain.cancelAndHoldAtTime(now);
    else bus.gain.cancelScheduledValues(now);
    bus.gain.setTargetAtTime(0, now, FADE_OUT_TAU_S);
    for (const oscillator of drones) oscillator.stop(now + FADE_OUT_TOTAL_S);
    graph = null;
  }

  return {
    start,
    stop,
    /** Open the filter as the Sun climbs. @param {number} deg Sun elevation in degrees */
    setSunElevation(deg) {
      const [low, high] = SUN_RANGE_DEG;
      brightness = clamp01((deg - low) / (high - low));
      if (graph) graph.filter.frequency.setTargetAtTime(cutoffHz(), context.currentTime, 2);
    },
    dispose: stop,
  };
}
