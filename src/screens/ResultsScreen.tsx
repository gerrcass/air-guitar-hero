import { difficultyLabel } from "../components/DifficultyPicker";
import { Stars } from "../components/Stars";
import { songById } from "../content/songs";
import { playHref } from "../state/router";
import { useLastRun } from "../state/run";

function formatScore(score: number): string {
  return new Intl.NumberFormat("en-US").format(score);
}

function modeLabel(mode: string): string {
  switch (mode) {
    case "career":
      return "Career";
    case "quickplay":
      return "Quickplay";
    case "practice":
      return "Practice";
    case "faceoff":
      return "Face-off";
    case "tutorial":
      return "Tutorial";
    default:
      return mode;
  }
}

export function ResultsScreen(): React.JSX.Element {
  const run = useLastRun();

  if (!run) {
    return (
      <div className="screen results-screen results-screen--empty">
        <p className="eyebrow">Results</p>
        <h1>No run to show yet</h1>
        <p className="results-empty__copy">
          A results card appears here after a run ends. Pick a song from Quickplay, continue the
          Career ladder, or drill a section in Practice.
        </p>
        <div className="results-actions">
          <a className="btn btn-primary" href="#/quickplay">
            Open quickplay
          </a>
          <a className="btn btn-secondary" href="#/career">
            Career
          </a>
          <a className="btn btn-ghost" href="#/">
            Main menu
          </a>
        </div>
      </div>
    );
  }

  const song = songById(run.songId);
  const retryHref =
    run.mode === "practice"
      ? "#/practice"
      : run.mode === "career" || run.mode === "quickplay"
        ? playHref(run.mode, run.songId, run.difficulty)
        : "#/faceoff";
  const hubHref =
    run.mode === "career"
      ? "#/career"
      : run.mode === "practice"
        ? "#/practice"
        : run.mode === "faceoff"
          ? "#/faceoff"
          : "#/quickplay";
  const savedLabel =
    run.mode === "career"
      ? run.passed
        ? "Career progress and best score saved."
        : "Failed career run — no career progress saved."
      : run.mode === "quickplay"
        ? run.passed
          ? "Best score saved for this song and difficulty."
          : "Failed run — no best score saved."
        : "Practice rep — saves untouched.";

  return (
    <div className={`screen results-screen${run.passed ? " is-pass" : " is-fail"}`}>
      <div className="results-burst" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => (
          <span key={index} style={{ ["--i" as string]: String(index) }} />
        ))}
      </div>
      <header className="results-head">
        <p className="eyebrow">
          {modeLabel(run.mode)} · {difficultyLabel(run.difficulty)}
          {run.sectionLabel ? ` · ${run.sectionLabel}` : ""}
        </p>
        <h1>{run.passed ? "The crowd heard you." : "The room went quiet."}</h1>
        <p className="results-song">
          <strong>{song.title}</strong> · {song.artist}
        </p>
        <div className="results-stars">
          <Stars value={run.stars} label={`${run.stars} of 5 stars`} />
          {run.newBest && <span className="new-best">New best</span>}
        </div>
      </header>

      <div className="results-score">
        <span className="results-score__label">Final score</span>
        <strong className="results-score__value">{formatScore(run.score)}</strong>
        <span className="results-score__note">{savedLabel}</span>
      </div>

      <div className="results-metrics">
        <div>
          <span>Accuracy</span>
          <strong>{Math.round(run.accuracy * 100)}%</strong>
        </div>
        <div>
          <span>Best streak</span>
          <strong>{run.maxStreak}</strong>
        </div>
        <div>
          <span>Sustain ticks</span>
          <strong>{run.sustainTicks}</strong>
        </div>
        <div>
          <span>Star activations</span>
          <strong>{run.starPowerActivations}</strong>
        </div>
      </div>

      <table className="results-judgements">
        <caption className="sr-only">Judgement counts</caption>
        <tbody>
          {(["perfect", "great", "good", "miss"] as const).map((judgement) => (
            <tr key={judgement} className={`judgement-row judgement-row--${judgement}`}>
              <th scope="row">{judgement}</th>
              <td>{run.judgeCounts[judgement]}</td>
            </tr>
          ))}
          <tr className="judgement-row judgement-row--total">
            <th scope="row">note groups</th>
            <td>{run.totalNotes}</td>
          </tr>
        </tbody>
      </table>

      {run.mode === "career" && run.passed && (
        <p className="results-unlock">
          {run.stars === 5
            ? "Five stars. The next song is waiting."
            : "Cleared. Replay it for more stars — and check the career map for the next unlock."}
        </p>
      )}

      <div className="results-actions">
        <a className="btn btn-primary" href={retryHref}>
          Retry {run.mode === "practice" ? "setup" : "run"}
        </a>
        <a className="btn btn-secondary" href={hubHref}>
          Back to {modeLabel(run.mode)}
        </a>
        {run.mode !== "practice" && (
          <a className="btn btn-ghost" href="#/practice">
            Practice this song
          </a>
        )}
        <a className="btn btn-ghost" href="#/">
          Quit to menu
        </a>
      </div>

      <p className="results-footnote">
        {run.passed
          ? "Stars come from the chart's par score: pass for one, then 35%, 55%, 75%, and 90% of par for two through five."
          : "Failure is a moment, not lost progress. Retry, slow it down in Practice, or pick a lower difficulty."}
      </p>
    </div>
  );
}
