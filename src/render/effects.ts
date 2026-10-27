import type { GameEvent } from "../game/types";

/** A small queue between the engine loop and the renderer; drains once per frame. */
export class RenderEffects {
  private queue: GameEvent[] = [];

  push(event: GameEvent): void {
    this.queue.push(event);
    if (this.queue.length > 200) this.queue.shift();
  }

  drain(): GameEvent[] {
    if (this.queue.length === 0) return [];
    const events = this.queue;
    this.queue = [];
    return events;
  }

  clear(): void {
    this.queue = [];
  }
}
