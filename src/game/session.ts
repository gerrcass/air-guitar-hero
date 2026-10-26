import {
  BASE_GEM_POINTS,
  GOOD_WINDOW,
  GREAT_WINDOW,
  JUDGEMENT_WEIGHT,
  multiplierForStreak,
  PERFECT_WINDOW,
  ROCK_HIT_GAIN,
  ROCK_MISS_DRAIN,
  ROCK_OVERSTRUM_DRAIN,
  STAR_PHRASE_FILL,
  STAR_POWER_MIN_ACTIVATION,
  STAR_POWER_MULTIPLIER,
  START_ROCK,
  SUSTAIN_TICK_POINTS,
  starPowerDurationSeconds,
  sustainTickSeconds,
} from "./constants";
import type {
  Chart,
  GameEvent,
  GameSnapshot,
  Judgement,
  Lane,
  NoteState,
  NoteStatus,
  SessionOptions,
} from "./types";

interface StarPhrase {
  readonly noteIds: readonly number[];
  complete: boolean;
  failed: boolean;
}

const LANE_COUNT = 5;

function emptyCounts(): Record<Judgement, number> {
  return { perfect: 0, great: 0, good: 0, miss: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function gradeTiming(delta: number, goodWindow: number): Judgement | null {
  const abs = Math.abs(delta);
  if (abs <= PERFECT_WINDOW) return "perfect";
  if (abs <= GREAT_WINDOW) return "great";
  if (abs <= goodWindow) return "good";
  return null;
}

/**
 * A pure, clock-injected run. All methods return values; the engine never reads ambient
 * time, the DOM, audio, or storage.
 */
export class GameSession {
  private readonly chart: Chart;
  private readonly options: SessionOptions;
  private readonly goodWindow: number;
  private readonly finishTime: number;
  private readonly tickSeconds: number;
  private readonly starPowerSeconds: number;
  private readonly noteIndexById = new Map<number, number>();
  private readonly starPhrases: StarPhrase[] = [];

  private states: NoteState[];
  private held: boolean[] = Array.from({ length: LANE_COUNT }, () => false);
  private whammy = false;
  private nextTick = new Map<number, number>();

  private currentTime: number;
  private score = 0;
  private streak = 0;
  private maxStreak = 0;
  private rock = START_ROCK;
  private starPower = 0;
  private starPowerUntil = 0;
  private starPowerActive = false;
  private starPowerActivations = 0;
  private sustainTicks = 0;
  private judgeCounts = emptyCounts();
  private failed = false;
  private finished = false;
  private totalNotes = 0;
  private judgedNotes = 0;
  private finishedEmitted = false;

  constructor(chart: Chart, options: SessionOptions) {
    this.chart = chart;
    this.options = options;
    this.goodWindow = GOOD_WINDOW[options.difficulty];
    this.finishTime = options.endTime ?? chart.duration;
    this.tickSeconds = sustainTickSeconds(chart.bpm);
    this.starPowerSeconds = starPowerDurationSeconds(chart.bpm);
    this.currentTime = options.startTime ?? 0;

    this.states = chart.notes.map((note, index) => {
      this.noteIndexById.set(note.id, index);
      return {
        id: note.id,
        status: "pending" as NoteStatus,
        judgement: null,
        sustainTicks: 0,
      };
    });

    const start = options.startTime ?? 0;
    for (let i = 0; i < chart.notes.length; i += 1) {
      const note = chart.notes[i];
      if (!note) continue;
      if (note.time + this.goodWindow < start || note.time > this.finishTime + this.goodWindow) {
        this.states[i] = { ...this.states[i], status: "skipped" } as NoteState;
      } else {
        this.totalNotes += 1;
      }
    }

    this.buildStarPhrases();
  }

  private buildStarPhrases(): void {
    let run: number[] = [];
    const flush = (): void => {
      if (run.length === 0) return;
      const hasSkipped = run.some((id) => this.stateFor(id)?.status === "skipped");
      if (!hasSkipped) this.starPhrases.push({ noteIds: run, complete: false, failed: false });
      run = [];
    };
    for (const note of this.chart.notes) {
      if (note.star) {
        const state = this.stateFor(note.id);
        if (state?.status !== "skipped") run.push(note.id);
      } else {
        flush();
      }
    }
    flush();
  }

  private stateFor(id: number): NoteState | undefined {
    const index = this.noteIndexById.get(id);
    return index === undefined ? undefined : this.states[index];
  }

  private setState(id: number, patch: Partial<NoteState>): void {
    const index = this.noteIndexById.get(id);
    const existing = index === undefined ? undefined : this.states[index];
    if (index === undefined || !existing) return;
    this.states[index] = { ...existing, ...patch };
  }

  private noteFor(id: number): (typeof this.chart.notes)[number] | undefined {
    const index = this.noteIndexById.get(id);
    return index === undefined ? undefined : this.chart.notes[index];
  }

  private effectiveMultiplier(): number {
    const base = multiplierForStreak(this.streak);
    return this.starPowerActive ? base * STAR_POWER_MULTIPLIER : base;
  }

  private baseMultiplier(): number {
    return multiplierForStreak(this.streak);
  }

  private isStarPowerLive(time: number): boolean {
    return this.starPowerActive && time < this.starPowerUntil;
  }

  private isHoldingSustain(time: number): boolean {
    for (const note of this.chart.notes) {
      if (note.duration <= 0) continue;
      const state = this.stateFor(note.id);
      if (state?.status !== "holding") continue;
      if (time >= note.time && time <= note.time + note.duration) return true;
    }
    return false;
  }

  private canHopoTarget(noteId: number): boolean {
    const index = this.noteIndexById.get(noteId);
    if (index === undefined || index === 0) return false;
    const previous = this.chart.notes[index - 1];
    if (!previous) return false;
    const previousState = this.stateFor(previous.id);
    return (
      previousState !== undefined &&
      (previousState.status === "hit" ||
        previousState.status === "holding" ||
        previousState.status === "released")
    );
  }

  private earliestCandidate(time: number, requireHeld: boolean): number | null {
    let best: number | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const note of this.chart.notes) {
      const state = this.stateFor(note.id);
      if (state?.status !== "pending") continue;
      const delta = Math.abs(note.time - time);
      if (delta > this.goodWindow) continue;
      if (requireHeld && !note.lanes.every((lane) => this.held[lane])) continue;
      if (delta < bestDelta) {
        best = note.id;
        bestDelta = delta;
      }
    }
    return best;
  }

  private earliestHopo(time: number): number | null {
    let best: number | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const note of this.chart.notes) {
      if (!note.hopo || note.lanes.length > 1) continue;
      const state = this.stateFor(note.id);
      if (state?.status !== "pending") continue;
      const delta = Math.abs(note.time - time);
      if (delta > this.goodWindow) continue;
      if (!note.lanes.every((lane) => this.held[lane])) continue;
      if (!this.canHopoTarget(note.id)) continue;
      if (delta < bestDelta) {
        best = note.id;
        bestDelta = delta;
      }
    }
    return best;
  }

  private completeStarPhrases(time: number): GameEvent[] {
    const events: GameEvent[] = [];
    for (let i = 0; i < this.starPhrases.length; i += 1) {
      const phrase = this.starPhrases[i];
      if (!phrase || phrase.complete || phrase.failed) continue;
      const states = phrase.noteIds.map((id) => this.stateFor(id));
      if (states.some((state) => state?.status === "missed")) {
        phrase.failed = true;
        continue;
      }
      const allDone = states.every(
        (state) =>
          state !== undefined &&
          (state.status === "hit" || state.status === "holding" || state.status === "released"),
      );
      if (allDone) {
        phrase.complete = true;
        this.starPower = clamp(this.starPower + STAR_PHRASE_FILL, 0, 1);
        events.push({ type: "starPhrase", time, phraseIndex: i });
      }
    }
    return events;
  }

  private registerJudgement(
    noteId: number,
    judgement: Judgement,
    time: number,
    hopoHit = false,
  ): GameEvent[] {
    const note = this.noteFor(noteId);
    if (!note) return [];
    const events: GameEvent[] = [];
    const judged = judgement === "miss";
    this.judgedNotes += 1;
    this.judgeCounts[judgement] += 1;

    if (judged) {
      this.streak = 0;
      this.rock = clamp(this.rock - ROCK_MISS_DRAIN, 0, 1);
      this.setState(noteId, { status: "missed", judgement: "miss" });
      events.push({
        type: "judgement",
        time,
        noteId,
        judgement,
        points: 0,
        gemCount: note.lanes.length,
        hopoHit: false,
      });
      this.checkFailure(time, events);
      return events;
    }

    this.streak += 1;
    this.maxStreak = Math.max(this.maxStreak, this.streak);
    const multiplier = this.effectiveMultiplier();
    const points = note.lanes.length * BASE_GEM_POINTS * multiplier;
    this.score += points;
    this.rock = clamp(this.rock + ROCK_HIT_GAIN[judgement], 0, 1);
    this.setState(noteId, {
      status: note.duration > 0 ? "holding" : "hit",
      judgement,
    });
    if (note.duration > 0) {
      this.nextTick.set(noteId, note.time + this.tickSeconds);
    }
    events.push({
      type: "judgement",
      time,
      noteId,
      judgement,
      points,
      gemCount: note.lanes.length,
      ...(hopoHit ? { hopoHit: true } : {}),
    });
    events.push(...this.completeStarPhrases(time));
    return events;
  }

  private checkFailure(time: number, events: GameEvent[]): void {
    if (this.failed) return;
    if (this.rock > 0) return;
    if (this.options.noFail) return;
    this.failed = true;
    this.rock = 0;
    events.push({ type: "failed", time });
  }

  private updateSustains(time: number): GameEvent[] {
    const events: GameEvent[] = [];
    for (const note of this.chart.notes) {
      if (note.duration <= 0) continue;
      const state = this.stateFor(note.id);
      if (state?.status !== "holding") continue;
      const end = note.time + note.duration;
      const lanesHeld = note.lanes.every((lane) => this.held[lane]);
      if (!lanesHeld) {
        this.setState(note.id, { status: "released" });
        this.nextTick.delete(note.id);
        continue;
      }
      let next = this.nextTick.get(note.id) ?? note.time + this.tickSeconds;
      const ceiling = Math.min(time, end);
      while (next <= ceiling) {
        const multiplier = this.effectiveMultiplier();
        const points = SUSTAIN_TICK_POINTS * multiplier;
        this.score += points;
        this.sustainTicks += 1;
        this.setState(note.id, { sustainTicks: (state.sustainTicks ?? 0) + 1 });
        let starGain = 0;
        if (note.star && this.whammy) {
          starGain = 0.002;
          this.starPower = clamp(this.starPower + starGain, 0, 1);
        }
        events.push({ type: "sustainTick", time: next, noteId: note.id, points, starGain });
        next += this.tickSeconds;
      }
      this.nextTick.set(note.id, next);
      if (time >= end) {
        this.setState(note.id, { status: "released" });
        this.nextTick.delete(note.id);
      }
    }
    return events;
  }

  private updateStarPower(time: number): GameEvent[] {
    if (!this.starPowerActive) return [];
    if (time < this.starPowerUntil) return [];
    this.starPowerActive = false;
    return [{ type: "starPowerExpired", time }];
  }

  update(time: number): GameEvent[] {
    if (this.failed || this.finished) return [];
    this.currentTime = Math.max(this.currentTime, time);
    const events: GameEvent[] = [];

    events.push(...this.updateStarPower(this.currentTime));
    events.push(...this.updateSustains(this.currentTime));

    for (const note of this.chart.notes) {
      const state = this.stateFor(note.id);
      if (state?.status !== "pending") continue;
      if (this.currentTime - note.time > this.goodWindow) {
        events.push(...this.registerJudgement(note.id, "miss", note.time + this.goodWindow));
        if (this.failed) break;
      }
    }

    if (!this.failed && this.currentTime >= this.finishTime) {
      for (const note of this.chart.notes) {
        const state = this.stateFor(note.id);
        if (state?.status === "pending" && note.time <= this.finishTime) {
          events.push(...this.registerJudgement(note.id, "miss", this.finishTime));
        }
        if (state?.status === "holding") {
          this.setState(note.id, { status: "released" });
        }
      }
      this.finished = true;
      if (!this.finishedEmitted) {
        this.finishedEmitted = true;
        events.push({ type: "finished", time: this.finishTime });
      }
    }

    return events;
  }

  pressFret(lane: Lane, time: number): GameEvent[] {
    if (this.failed || this.finished) return [];
    this.held[lane] = true;
    this.currentTime = Math.max(this.currentTime, time);
    const hopo = this.earliestHopo(time);
    if (hopo === null) return [];
    return this.registerJudgement(hopo, this.judgeFor(hopo, time), time, true);
  }

  releaseFret(lane: Lane, time: number): GameEvent[] {
    this.held[lane] = false;
    this.currentTime = Math.max(this.currentTime, time);
    if (this.failed || this.finished) return [];
    const events: GameEvent[] = [];
    for (const note of this.chart.notes) {
      if (note.duration <= 0) continue;
      const state = this.stateFor(note.id);
      if (state?.status !== "holding") continue;
      if (!note.lanes.every((held) => this.held[held])) {
        this.setState(note.id, { status: "released" });
        this.nextTick.delete(note.id);
      }
    }
    return events;
  }

  strum(time: number): GameEvent[] {
    if (this.failed || this.finished) return [];
    this.currentTime = Math.max(this.currentTime, time);
    const candidate = this.earliestCandidate(time, true);
    if (candidate !== null) {
      return this.registerJudgement(candidate, this.judgeFor(candidate, time), time);
    }
    if (this.isHoldingSustain(time)) return [];
    const events: GameEvent[] = [{ type: "overstrum", time }];
    this.streak = 0;
    this.rock = clamp(this.rock - ROCK_OVERSTRUM_DRAIN, 0, 1);
    this.checkFailure(time, events);
    return events;
  }

  private judgeFor(noteId: number, time: number): Judgement {
    const note = this.noteFor(noteId);
    if (!note) return "miss";
    return gradeTiming(time - note.time, this.goodWindow) ?? "miss";
  }

  setWhammy(on: boolean): void {
    this.whammy = on;
  }

  activateStarPower(time: number): GameEvent[] {
    if (this.failed || this.finished) return [];
    if (this.starPower < STAR_POWER_MIN_ACTIVATION) return [];
    if (this.isStarPowerLive(time)) return [];
    this.starPower = 0;
    this.starPowerActive = true;
    this.starPowerUntil = time + this.starPowerSeconds;
    this.starPowerActivations += 1;
    this.currentTime = Math.max(this.currentTime, time);
    return [{ type: "starPowerActivated", time, duration: this.starPowerSeconds }];
  }

  snapshot(): GameSnapshot {
    const weighted =
      this.judgeCounts.perfect * JUDGEMENT_WEIGHT.perfect +
      this.judgeCounts.great * JUDGEMENT_WEIGHT.great +
      this.judgeCounts.good * JUDGEMENT_WEIGHT.good;
    const accuracy = this.judgedNotes === 0 ? 0 : weighted / this.judgedNotes;
    return {
      time: this.currentTime,
      score: this.score,
      streak: this.streak,
      maxStreak: this.maxStreak,
      baseMultiplier: this.baseMultiplier(),
      multiplier: this.effectiveMultiplier(),
      rock: this.rock,
      starPower: this.starPower,
      starPowerActive: this.isStarPowerLive(this.currentTime),
      starPowerRemaining: this.isStarPowerLive(this.currentTime)
        ? Math.max(0, this.starPowerUntil - this.currentTime)
        : 0,
      judgeCounts: { ...this.judgeCounts },
      noteStates: this.states,
      heldLanes: [...this.held],
      failed: this.failed,
      finished: this.finished,
      accuracy,
      sustainTicks: this.sustainTicks,
      starPowerActivations: this.starPowerActivations,
      totalNotes: this.totalNotes,
      judgedNotes: this.judgedNotes,
    };
  }

  get chartRef(): Chart {
    return this.chart;
  }
}
