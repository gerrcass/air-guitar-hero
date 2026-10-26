import type { SongDefinition } from "../content/types";
import type { GameSnapshot } from "../game/types";
import { Meter } from "./Meter";

interface RunHudProps {
  readonly snapshot: GameSnapshot;
  readonly song: SongDefinition;
  readonly difficulty: string;
  readonly sectionLabel?: string;
  readonly playerLabel?: string;
  readonly paused: boolean;
  readonly onPause: () => void;
  readonly onStarPower?: () => void;
  readonly compact?: boolean;
}

function formatScore(score: number): string {
  return new Intl.NumberFormat("en-US").format(score);
}

export function RunHud({
  snapshot,
  song,
  difficulty,
  sectionLabel,
  playerLabel,
  paused,
  onPause,
  onStarPower,
  compact = false,
}: RunHudProps): React.JSX.Element {
  const progress =
    snapshot.time < 0 ? 0 : Math.min(1, snapshot.time / Math.max(1, song.targetDuration));
  const starReady = snapshot.starPower >= 0.25 && !snapshot.starPowerActive;
  return (
    <section
      className={`run-hud${compact ? " run-hud--compact" : ""}`}
      aria-label="Performance HUD"
    >
      <div className="run-hud__top">
        <div className="run-hud__song">
          <span className="run-hud__eyebrow">
            {playerLabel ? `${playerLabel} · ` : ""}
            {difficulty}
            {sectionLabel ? ` · ${sectionLabel}` : ""}
          </span>
          <h2 className="run-hud__title">{song.title}</h2>
          <span className="run-hud__artist">{song.artist}</span>
        </div>
        <div className="run-hud__score">
          <span className="run-hud__score-label">Score</span>
          <strong className="run-hud__score-value">{formatScore(snapshot.score)}</strong>
        </div>
        <button type="button" className="btn btn-ghost run-hud__pause" onClick={onPause}>
          {paused ? "Resume" : "Pause"}
        </button>
      </div>

      <div className="run-hud__main">
        <div className="run-hud__streak" aria-hidden={snapshot.streak === 0}>
          <span className="run-hud__streak-value">{snapshot.streak}</span>
          <span className="run-hud__streak-label">streak</span>
          <span className="run-hud__multiplier">×{snapshot.multiplier}</span>
        </div>
        <div className="run-hud__meters">
          <Meter
            label="Rock meter"
            value={snapshot.rock}
            tone="rock"
            detail={
              snapshot.rock <= 0.2 ? "Crowd is losing it" : `${Math.round(snapshot.rock * 100)}%`
            }
          />
          <Meter
            label="Star power"
            value={snapshot.starPower}
            tone="star"
            detail={
              snapshot.starPowerActive
                ? `Active ${snapshot.starPowerRemaining.toFixed(1)}s`
                : starReady
                  ? "Ready"
                  : `${Math.round(snapshot.starPower * 100)}%`
            }
          />
          <Meter label="Song" value={progress} tone="progress" />
        </div>
        {onStarPower && (
          <button
            type="button"
            className={`btn btn-star${starReady ? " is-ready" : ""}`}
            onClick={onStarPower}
            disabled={!starReady}
            aria-label={starReady ? "Activate star power" : "Star power needs at least 25 percent"}
          >
            ★ Star Power
          </button>
        )}
      </div>

      <div className="run-hud__footer">
        <span>
          {snapshot.baseMultiplier}× base · {snapshot.starPowerActive ? "2× star" : "no star power"}
        </span>
        <span>
          Accuracy {snapshot.judgedNotes > 0 ? `${Math.round(snapshot.accuracy * 100)}%` : "—"}
        </span>
        <span>
          {snapshot.failed
            ? "Run failed"
            : snapshot.finished
              ? "Run complete"
              : snapshot.time < 0
                ? "Count-in"
                : "Live"}
        </span>
      </div>
    </section>
  );
}
