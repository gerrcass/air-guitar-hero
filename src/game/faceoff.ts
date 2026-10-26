export interface FaceOffScore {
  readonly failed: boolean;
  readonly score: number;
}

/**
 * Pro Face-Off rule: a failed player loses; if both fail, the later failure wins; if both
 * survive, the higher score wins. An exact tie is a draw.
 */
export function decideFaceOffWinner(
  p1: FaceOffScore,
  p2: FaceOffScore,
  failTimes: readonly [number, number] = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
): 1 | 2 | "draw" {
  if (p1.failed && !p2.failed) return 2;
  if (p2.failed && !p1.failed) return 1;
  if (p1.failed && p2.failed) {
    if (failTimes[0] < failTimes[1]) return 2;
    if (failTimes[1] < failTimes[0]) return 1;
    return "draw";
  }
  if (p1.score === p2.score) return "draw";
  return p1.score > p2.score ? 1 : 2;
}
