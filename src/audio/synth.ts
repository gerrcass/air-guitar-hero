/** Small, dependency-free synthesis helpers. */

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function makeDistortionCurve(amount = 3): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  const normalizer = Math.tanh(amount);
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = normalizer === 0 ? x : Math.tanh(x * amount) / normalizer;
  }
  return curve;
}

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Deterministic noise so audio is identical across sessions and test runs. */
export function createNoiseBuffer(ctx: AudioContext, seconds = 2.5, seed = 0x5eed): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const random = lcg(seed);
  for (let i = 0; i < length; i += 1) {
    data[i] = random() * 2 - 1;
  }
  return buffer;
}

/** Real seconds for a song-time duration at a practice playback speed. */
export function stretchDuration(seconds: number, speed: number): number {
  return seconds / Math.max(0.25, speed);
}

export type Tone = "saw" | "square" | "triangle";
