import type { Settings } from "../state/settings";
import { EventScheduler } from "./scheduler";
import { createNoiseBuffer, makeDistortionCurve, midiToFrequency, stretchDuration } from "./synth";
import type { Arrangement, AudioEvent, DrumKind, MelodicEvent } from "./types";

export class AudioEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AudioEngineError";
  }
}

export interface StartRunOptions {
  readonly startTime?: number;
  readonly speed?: number;
  readonly countInBeats?: number;
}

type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContext;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const LEAD_CURVE = makeDistortionCurve(4);
const RHYTHM_CURVE = makeDistortionCurve(2.4);

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private crowdBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private scheduler: EventScheduler | null = null;
  private arrangement: Arrangement | null = null;
  private startOrigin = 0;
  private startSongTime = 0;
  private speed = 1;
  private playing = false;
  private paused = false;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private readonly sources = new Map<AudioScheduledSourceNode, AudioNode[]>();
  private readonly runNodes: AudioNode[] = [];
  private volumeSettings: Pick<Settings, "musicVolume" | "sfxVolume" | "crowdVolume"> = {
    musicVolume: 0.75,
    sfxVolume: 0.8,
    crowdVolume: 0.42,
  };

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get songDuration(): number {
    return this.arrangement?.duration ?? 0;
  }

  async unlock(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        try {
          await this.ctx.resume();
        } catch (error) {
          throw new AudioEngineError(
            `The audio context could not resume: ${error instanceof Error ? error.message : "unknown error"}`,
          );
        }
      }
      return;
    }
    if (typeof window === "undefined") {
      throw new AudioEngineError("Audio is only available in a browser.");
    }
    const WebkitWindow = window as Window & {
      webkitAudioContext?: AudioContextConstructor;
    };
    const Constructor: AudioContextConstructor | undefined =
      window.AudioContext ?? WebkitWindow.webkitAudioContext;
    if (!Constructor) {
      throw new AudioEngineError(
        "This browser does not expose the Web Audio API. Try a current Chrome, Firefox, or Safari.",
      );
    }
    let ctx: AudioContext | null = null;
    try {
      ctx = new Constructor({ latencyHint: "interactive" });
      await ctx.resume();
    } catch (error) {
      try {
        await ctx?.close();
      } catch {
        // The context never started, so there is nothing else to clean up.
      }
      throw new AudioEngineError(
        `Audio could not start. Check your browser's sound permissions and try again. (${error instanceof Error ? error.message : "unknown error"})`,
      );
    }
    this.ctx = ctx;
    this.initGraph();
  }

  private initGraph(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const master = ctx.createDynamicsCompressor();
    master.threshold.value = -12;
    master.knee.value = 12;
    master.ratio.value = 4;
    master.attack.value = 0.003;
    master.release.value = 0.25;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.9;
    master.connect(masterGain);
    masterGain.connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.crowdBus = ctx.createGain();
    this.musicBus.connect(master);
    this.sfxBus.connect(master);
    this.crowdBus.connect(master);
    this.noiseBuffer = createNoiseBuffer(ctx);
    this.applyVolumes();
  }

  setVolumes(settings: Pick<Settings, "musicVolume" | "sfxVolume" | "crowdVolume">): void {
    this.volumeSettings = { ...settings };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    this.musicBus?.gain.setTargetAtTime(
      clamp(this.volumeSettings.musicVolume, 0, 1) * 0.62,
      now,
      0.02,
    );
    this.sfxBus?.gain.setTargetAtTime(clamp(this.volumeSettings.sfxVolume, 0, 1) * 0.72, now, 0.02);
    this.crowdBus?.gain.setTargetAtTime(
      clamp(this.volumeSettings.crowdVolume, 0, 1) * 0.3,
      now,
      0.02,
    );
  }

  private track(source: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    this.sources.set(source, nodes);
    source.addEventListener("ended", () => {
      source.disconnect();
      for (const node of nodes) {
        try {
          node.disconnect();
        } catch {
          // Already disconnected by a stop.
        }
      }
      this.sources.delete(source);
    });
  }

  private stopAllSources(): void {
    for (const [source, nodes] of this.sources) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
      source.disconnect();
      for (const node of nodes) {
        try {
          node.disconnect();
        } catch {
          // Already disconnected.
        }
      }
    }
    this.sources.clear();
    for (const node of this.runNodes) {
      try {
        node.disconnect();
      } catch {
        // Already disconnected.
      }
    }
    this.runNodes.length = 0;
  }

  async startRun(arrangement: Arrangement, options: StartRunOptions = {}): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) throw new AudioEngineError("Audio has not been unlocked yet.");
    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch (error) {
        throw new AudioEngineError(
          `Audio could not resume: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }
    this.stopRun();
    this.arrangement = arrangement;
    this.startSongTime = Math.max(0, options.startTime ?? 0);
    this.speed = clamp(options.speed ?? 1, 0.5, 1.25);
    const beatSeconds = 60 / arrangement.bpm;
    const countInBeats = Math.max(0, options.countInBeats ?? 4);
    this.startOrigin = ctx.currentTime + 0.08 + countInBeats * beatSeconds;

    for (let beat = 0; beat < countInBeats; beat += 1) {
      this.scheduleClick(this.startOrigin - (countInBeats - beat) * beatSeconds, beat === 0);
    }

    this.startCrowd();
    this.scheduler = new EventScheduler(arrangement.events);
    this.scheduler.start(this.startOrigin, this.startSongTime, this.speed);
    this.playing = true;
    this.paused = false;
    this.pump();
    this.tickTimer = setInterval(() => this.pump(), 40);
  }

  private pump(): void {
    const ctx = this.ctx;
    const scheduler = this.scheduler;
    if (!ctx || !scheduler || !this.playing || this.paused) return;
    if (ctx.state !== "running") return;
    const due = scheduler.due(ctx.currentTime);
    const floor = ctx.currentTime + 0.002;
    for (const entry of due) {
      this.scheduleAudioEvent(entry.event, Math.max(floor, entry.when));
    }
  }

  now(): number {
    if (!this.ctx || !this.arrangement) return this.startSongTime;
    return this.startSongTime + (this.ctx.currentTime - this.startOrigin) * this.speed;
  }

  countInRemaining(): number {
    if (!this.ctx || !this.playing) return 0;
    return Math.max(0, this.startOrigin - this.ctx.currentTime);
  }

  async pause(): Promise<void> {
    if (!this.ctx || !this.playing || this.paused) return;
    this.paused = true;
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    try {
      await this.ctx.suspend();
    } catch {
      // The run stays paused even if the browser refuses to suspend.
    }
  }

  async resume(): Promise<void> {
    if (!this.ctx || !this.playing || !this.paused) return;
    try {
      await this.ctx.resume();
      this.paused = false;
      this.pump();
      this.tickTimer = setInterval(() => this.pump(), 40);
    } catch (error) {
      this.paused = true;
      throw new AudioEngineError(
        `Audio could not resume: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  stopRun(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.stopAllSources();
    this.scheduler = null;
    this.arrangement = null;
    this.playing = false;
    this.paused = false;
    this.startOrigin = 0;
    this.startSongTime = 0;
  }

  async dispose(): Promise<void> {
    this.stopRun();
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        // Closing a context twice is harmless.
      }
      this.ctx = null;
    }
  }

  setCrowdEnergy(_energy: number): void {
    // Crowd intensity is carried by the mix; this hook is reserved for stage-reactive beds.
  }

  private startCrowd(): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer || !this.crowdBus) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 520;
    filter.Q.value = 0.55;
    const gain = ctx.createGain();
    gain.gain.value = 0.55;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.crowdBus);
    source.start(ctx.currentTime + 0.02);
    this.track(source, [filter, gain]);
  }

  private scheduleAudioEvent(event: AudioEvent, when: number): void {
    if (event.instrument === "drums") {
      this.scheduleDrum(event.drum, when, event.velocity);
      return;
    }
    this.scheduleMelodic(event, when);
  }

  private scheduleMelodic(event: MelodicEvent, when: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const duration = Math.max(0.06, stretchDuration(event.duration, this.speed));
    const frequency = midiToFrequency(event.midi);
    const voiceGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    const nodes: AudioNode[] = [voiceGain, filter];

    if (event.instrument === "lead") {
      const osc = ctx.createOscillator();
      const tone = this.arrangement?.leadTone ?? "saw";
      osc.type = tone === "saw" ? "sawtooth" : tone;
      osc.frequency.setValueAtTime(frequency, when);
      filter.frequency.setValueAtTime(2700 + event.velocity * 900, when);
      filter.Q.setValueAtTime(1.2, when);
      const shaper = ctx.createWaveShaper();
      shaper.curve = LEAD_CURVE;
      shaper.oversample = "2x";
      osc.connect(filter);
      filter.connect(shaper);
      shaper.connect(voiceGain);
      voiceGain.connect(this.musicBus);
      voiceGain.gain.setValueAtTime(0.0001, when);
      voiceGain.gain.exponentialRampToValueAtTime(0.16 * event.velocity, when + 0.008);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      osc.start(when);
      osc.stop(when + duration + 0.06);
      this.track(osc, [...nodes, shaper]);
      return;
    }

    if (event.instrument === "rhythm") {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(frequency, when);
      filter.frequency.setValueAtTime(1500 + event.velocity * 700, when);
      const shaper = ctx.createWaveShaper();
      shaper.curve = RHYTHM_CURVE;
      shaper.oversample = "2x";
      osc.connect(filter);
      filter.connect(shaper);
      shaper.connect(voiceGain);
      voiceGain.connect(this.musicBus);
      voiceGain.gain.setValueAtTime(0.0001, when);
      voiceGain.gain.exponentialRampToValueAtTime(0.075 * event.velocity, when + 0.006);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      osc.start(when);
      osc.stop(when + duration + 0.04);
      this.track(osc, [...nodes, shaper]);
      return;
    }

    if (event.instrument === "bass") {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(frequency, when);
      filter.frequency.setValueAtTime(480, when);
      osc.connect(filter);
      filter.connect(voiceGain);
      voiceGain.connect(this.musicBus);
      voiceGain.gain.setValueAtTime(0.0001, when);
      voiceGain.gain.exponentialRampToValueAtTime(0.18 * event.velocity, when + 0.012);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      osc.start(when);
      osc.stop(when + duration + 0.05);
      this.track(osc, nodes);
      return;
    }

    // Pad: two detuned triangles, slow attack.
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    oscA.type = "triangle";
    oscB.type = "sine";
    oscA.frequency.setValueAtTime(frequency, when);
    oscB.frequency.setValueAtTime(frequency * 1.005, when);
    oscA.detune.value = -4;
    oscB.detune.value = 5;
    filter.frequency.setValueAtTime(1400, when);
    const padGain = ctx.createGain();
    padGain.gain.value = 0.5;
    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(padGain);
    padGain.connect(voiceGain);
    voiceGain.connect(this.musicBus);
    voiceGain.gain.setValueAtTime(0.0001, when);
    voiceGain.gain.exponentialRampToValueAtTime(0.055 * event.velocity + 0.01, when + 0.16);
    voiceGain.gain.setValueAtTime(
      0.055 * event.velocity + 0.01,
      when + Math.max(0.2, duration - 0.25),
    );
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, when + duration + 0.22);
    oscA.start(when);
    oscB.start(when);
    oscA.stop(when + duration + 0.3);
    oscB.stop(when + duration + 0.3);
    this.track(oscA, [...nodes, padGain]);
    this.track(oscB, []);
  }

  private scheduleDrum(kind: DrumKind, when: number, velocity: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    if (kind === "kick") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, when);
      osc.frequency.exponentialRampToValueAtTime(42, when + 0.16);
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(0.5 * velocity, when + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.24);
      osc.connect(gain);
      gain.connect(this.musicBus);
      osc.start(when);
      osc.stop(when + 0.28);
      this.track(osc, [gain]);
      return;
    }
    if (!this.noiseBuffer) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    if (kind === "snare") {
      filter.type = "bandpass";
      filter.frequency.value = 1800;
      filter.Q.value = 0.8;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(0.22 * velocity, when + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.17);
    } else if (kind === "crash") {
      filter.type = "highpass";
      filter.frequency.value = 3800;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(0.13 * velocity, when + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.8);
    } else if (kind === "open-hat") {
      filter.type = "highpass";
      filter.frequency.value = 7000;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(0.05 * velocity, when + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    } else {
      filter.type = "highpass";
      filter.frequency.value = 7600;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(0.04 * velocity, when + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.045);
    }
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    source.start(when);
    source.stop(when + (kind === "crash" ? 0.9 : kind === "snare" ? 0.22 : 0.18));
    this.track(source, [filter, gain]);
  }

  private scheduleClick(when: number, accent: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = accent ? 1320 : 880;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.18 : 0.1, when + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(when);
    osc.stop(when + 0.09);
    this.track(osc, [gain]);
  }

  private blip(frequency: number, duration: number, type: OscillatorType, volume: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || ctx.state !== "running") return;
    const when = ctx.currentTime + 0.001;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(when);
    osc.stop(when + duration + 0.02);
    this.track(osc, [gain]);
  }

  playJudgement(judgement: "perfect" | "great" | "good" | "miss", streak = 0): void {
    if (judgement === "miss") {
      this.blip(120, 0.18, "sawtooth", 0.12);
      return;
    }
    const base = judgement === "perfect" ? 960 : judgement === "great" ? 760 : 600;
    this.blip(base + Math.min(240, streak * 4), 0.055, "square", 0.06);
  }

  playOverstrum(): void {
    this.blip(92, 0.14, "sawtooth", 0.1);
  }

  playStarPower(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || ctx.state !== "running") return;
    const when = ctx.currentTime + 0.001;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, when);
    osc.frequency.exponentialRampToValueAtTime(1100, when + 0.5);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.09, when + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.6);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(when);
    osc.stop(when + 0.65);
    this.track(osc, [gain]);
  }

  playUi(): void {
    this.blip(1180, 0.035, "sine", 0.05);
  }

  /**
   * Calibration click. A positive offset models late audio by delaying the visual side, so
   * the click stays immediate and the UI delays the pulse by the same positive offset.
   */
  playCalibrationClick(offsetMs: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || ctx.state !== "running") return;
    const delay = Math.max(0, -offsetMs) / 1000;
    this.scheduleClick(ctx.currentTime + 0.02 + delay, true);
  }
}

export const audioEngine = new AudioEngine();
