import type { AudioEvent } from "./types";

export interface DueEvent {
  readonly event: AudioEvent;
  readonly when: number;
}

/**
 * Converts chart-time events into AudioContext times with a look-ahead horizon. The
 * scheduler is deterministic and duplicate-free: each event is emitted once per start.
 */
export class EventScheduler {
  private readonly events: readonly AudioEvent[];
  private readonly horizon: number;
  private cursor = 0;
  private origin = 0;
  private startSongTime = 0;
  private speed = 1;
  private started = false;

  constructor(events: readonly AudioEvent[], horizon = 0.25) {
    this.events = events;
    this.horizon = horizon;
  }

  start(originSeconds: number, startSongTime: number, speed: number): void {
    this.origin = originSeconds;
    this.startSongTime = startSongTime;
    this.speed = Math.max(0.25, speed);
    this.started = true;
    this.cursor = 0;
    while (this.cursor < this.events.length) {
      const event = this.events[this.cursor];
      if (!event || event.time >= startSongTime - 0.0001) break;
      this.cursor += 1;
    }
  }

  due(nowSeconds: number): DueEvent[] {
    if (!this.started) return [];
    const elapsed = Math.max(0, nowSeconds - this.origin) * this.speed;
    const windowEnd = this.startSongTime + elapsed + this.horizon;
    const due: DueEvent[] = [];
    while (this.cursor < this.events.length) {
      const event = this.events[this.cursor];
      if (!event || event.time > windowEnd) break;
      const when = this.origin + (event.time - this.startSongTime) / this.speed;
      if (when >= nowSeconds - 0.05) due.push({ event, when });
      this.cursor += 1;
    }
    return due;
  }

  get scheduledCount(): number {
    return this.cursor;
  }

  get finished(): boolean {
    return this.cursor >= this.events.length;
  }
}
