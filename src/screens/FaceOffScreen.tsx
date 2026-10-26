import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioEngineError, audioEngine } from "../audio/engine";
import { AlbumArt } from "../components/AlbumArt";
import { DifficultyPicker, difficultyLabel } from "../components/DifficultyPicker";
import { GameCanvas } from "../components/GameCanvas";
import { Meter } from "../components/Meter";
import { getComposedSong } from "../content/composer";
import { SONGS, songById } from "../content/songs";
import { GameSession } from "../game/session";
import type { GameEvent, GameSnapshot } from "../game/types";
import { attachGamepads } from "../input/gamepad";
import { attachKeyboard, type InputPlayer } from "../input/keyboard";
import { RenderEffects } from "../render/effects";
import type { Route } from "../state/router";
import { approachSeconds, calibratedTime } from "../state/settings";
import { saveStore, useSave } from "../state/store";
import { useEffectiveSettings } from "../state/useReducedMotion";
import { installTestBridge } from "../testing/bridge";

type PlayRoute = Extract<Route, { name: "play" }>;

interface FaceOffScreenProps {
  readonly route?: PlayRoute;
}

interface FaceOffResult {
  readonly winner: 1 | 2 | "draw";
  readonly p1: GameSnapshot;
  readonly p2: GameSnapshot;
}

function formatScore(score: number): string {
  return new Intl.NumberFormat("en-US").format(score);
}

function MiniHud({
  snapshot,
  player,
  label,
  eliminated,
  onStar,
}: {
  readonly snapshot: GameSnapshot | null;
  readonly player: 1 | 2;
  readonly label: string;
  readonly eliminated: boolean;
  readonly onStar: (player: 1 | 2) => void;
}): React.JSX.Element {
  const starReady = (snapshot?.starPower ?? 0) >= 0.25 && !snapshot?.starPowerActive;
  return (
    <div className={`faceoff-hud faceoff-hud--p${player}${eliminated ? " is-eliminated" : ""}`}>
      <div className="faceoff-hud__title">
        <span className="faceoff-hud__label">{label}</span>
        {eliminated && <span className="faceoff-hud__out">ELIMINATED</span>}
      </div>
      <strong className="faceoff-hud__score">{formatScore(snapshot?.score ?? 0)}</strong>
      <div className="faceoff-hud__row">
        <span>{snapshot?.streak ?? 0} streak</span>
        <span>×{snapshot?.multiplier ?? 1}</span>
        <span>{Math.round((snapshot?.accuracy ?? 0) * 100)}%</span>
      </div>
      <Meter label="Rock" value={snapshot?.rock ?? 0} tone="rock" />
      <div className="faceoff-hud__star">
        <Meter label="Star" value={snapshot?.starPower ?? 0} tone="star" />
        <button
          type="button"
          className={`btn btn-star btn-small${starReady ? " is-ready" : ""}`}
          onClick={() => onStar(player)}
          disabled={!starReady}
        >
          Star
        </button>
      </div>
    </div>
  );
}

export function FaceOffScreen({ route }: FaceOffScreenProps): React.JSX.Element {
  const save = useSave();
  const settings = save.settings;
  const renderSettings = useEffectiveSettings(settings);
  const [phase, setPhase] = useState<"setup" | "playing" | "done">("setup");
  const initialSong = route?.songId ?? save.lastSongId ?? SONGS[0]?.id ?? "neon-throttle";
  const [songId, setSongId] = useState(
    SONGS.some((song) => song.id === initialSong) ? initialSong : (SONGS[0]?.id ?? ""),
  );
  const [difficulty, setDifficulty] = useState(route?.difficulty ?? save.lastDifficulty);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [countIn, setCountIn] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [result, setResult] = useState<FaceOffResult | null>(null);
  const [hud, setHud] = useState<[GameSnapshot | null, GameSnapshot | null]>([null, null]);
  const [pausedHud, setPausedHud] = useState<[GameSnapshot | null, GameSnapshot | null]>([
    null,
    null,
  ]);

  const composed = useMemo(() => getComposedSong(songId), [songId]);
  const song = useMemo(() => songById(songId), [songId]);
  const chart = composed.charts[difficulty];
  const firstNoteTime = chart.notes[0]?.time ?? 0;
  const startOffset = Math.max(0, firstNoteTime - approachSeconds(settings.noteSpeed));
  const effects = useMemo(() => [new RenderEffects(), new RenderEffects()] as const, []);
  const sessionsRef = useRef<[GameSession, GameSession] | null>(null);
  const p1SnapshotRef = useRef<GameSnapshot | null>(null);
  const p2SnapshotRef = useRef<GameSnapshot | null>(null);
  const startedRef = useRef(false);
  const pausedRef = useRef(false);
  const finalizedRef = useRef(false);
  const eliminatedRef = useRef<[boolean, boolean]>([false, false]);
  const failTimesRef = useRef<[number, number]>([
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ]);
  const settingsRef = useRef(settings);
  const autoplayUntilRef = useRef(0);
  const lastSfxRef = useRef(0);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const rematchRef = useRef<HTMLButtonElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    settingsRef.current = settings;
    audioEngine.setVolumes(settings);
  }, [settings]);
  useEffect(() => {
    if (phase === "setup") startButtonRef.current?.focus();
    if (phase === "done") rematchRef.current?.focus();
  }, [phase]);
  useEffect(() => {
    if (paused) resumeRef.current?.focus();
  }, [paused]);

  const makeSessions = useCallback((): [GameSession, GameSession] => {
    const options = {
      difficulty,
      noFail: settingsRef.current.noFail,
      startTime: startOffset,
    };
    return [new GameSession(chart, options), new GameSession(chart, options)];
  }, [chart, difficulty, startOffset]);

  const controllerTime = useCallback(() => audioEngine.now(), []);

  const finishFaceOff = useCallback((): void => {
    if (finalizedRef.current) return;
    const sessions = sessionsRef.current;
    if (!sessions) return;
    finalizedRef.current = true;
    audioEngine.stopRun();
    const p1 = sessions[0].snapshot();
    const p2 = sessions[1].snapshot();
    const p1Alive = !p1.failed;
    const p2Alive = !p2.failed;
    let winner: 1 | 2 | "draw";
    if (p1Alive && !p2Alive) winner = 1;
    else if (p2Alive && !p1Alive) winner = 2;
    else if (!p1Alive && !p2Alive) {
      const [p1Fail, p2Fail] = failTimesRef.current;
      winner = p1Fail < p2Fail ? 2 : p2Fail < p1Fail ? 1 : "draw";
    } else winner = p1.score === p2.score ? "draw" : p1.score > p2.score ? 1 : 2;
    setResult({ winner, p1, p2 });
    setPhase("done");
    setStarted(false);
    setPaused(false);
    pausedRef.current = false;
  }, []);

  const processEvents = useCallback(
    (player: 1 | 2, events: readonly GameEvent[]): void => {
      const target = player === 1 ? effects[0] : effects[1];
      for (const event of events) {
        target.push(event);
        const now = performance.now();
        if (event.type === "judgement" && now - lastSfxRef.current > 22) {
          audioEngine.playJudgement(event.judgement);
          lastSfxRef.current = now;
        } else if (event.type === "overstrum") {
          audioEngine.playOverstrum();
        } else if (event.type === "starPowerActivated") {
          audioEngine.playStarPower();
        }
      }
    },
    [effects],
  );

  const startFaceOff = useCallback(async (): Promise<void> => {
    setAudioError(null);
    setResult(null);
    setPhase("playing");
    finalizedRef.current = false;
    pausedRef.current = false;
    startedRef.current = false;
    setStarted(false);
    setPaused(false);
    eliminatedRef.current = [false, false];
    failTimesRef.current = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
    const sessions = makeSessions();
    sessionsRef.current = sessions;
    p1SnapshotRef.current = sessions[0].snapshot();
    p2SnapshotRef.current = sessions[1].snapshot();
    setHud([p1SnapshotRef.current, p2SnapshotRef.current]);
    effects[0].clear();
    effects[1].clear();
    saveStore.rememberSelection("faceoff", difficulty, songId);
    try {
      await audioEngine.unlock();
      audioEngine.setVolumes(settingsRef.current);
      await audioEngine.startRun(composed.arrangement, {
        startTime: startOffset,
        speed: 1,
        countInBeats: 4,
      });
      startedRef.current = true;
      setStarted(true);
      window.setTimeout(() => regionRef.current?.focus(), 0);
    } catch (error) {
      startedRef.current = false;
      setStarted(false);
      setAudioError(
        error instanceof AudioEngineError
          ? error.message
          : "Audio could not start. Check your browser's sound permissions and retry.",
      );
    }
  }, [composed.arrangement, difficulty, effects, makeSessions, songId, startOffset]);

  const pause = useCallback(async (): Promise<void> => {
    if (!startedRef.current || pausedRef.current || finalizedRef.current) return;
    pausedRef.current = true;
    setPaused(true);
    setPausedHud([p1SnapshotRef.current, p2SnapshotRef.current]);
    for (const session of sessionsRef.current ?? []) {
      for (let lane = 0; lane < 5; lane += 1)
        session.releaseFret(lane as 0 | 1 | 2 | 3 | 4, controllerTime());
      session.setWhammy(false);
    }
    try {
      await audioEngine.pause();
    } catch {
      // Keep the overlay and let the user retry from pause.
    }
  }, [controllerTime]);

  const resume = useCallback(async (): Promise<void> => {
    if (!pausedRef.current) return;
    try {
      await audioEngine.resume();
      pausedRef.current = false;
      setPaused(false);
    } catch {
      setAudioError("Audio could not resume. Restart the face-off.");
    }
  }, []);

  const activateStarPower = useCallback(
    (player: 1 | 2): void => {
      const sessions = sessionsRef.current;
      if (!sessions || pausedRef.current) return;
      const session = player === 1 ? sessions[0] : sessions[1];
      const events = session.activateStarPower(
        calibratedTime(controllerTime(), settingsRef.current.calibrationMs),
      );
      processEvents(player, events);
    },
    [controllerTime, processEvents],
  );

  useEffect(() => {
    if (!started) return;
    const callbacks = {
      onFretDown: (player: InputPlayer, lane: 0 | 1 | 2 | 3 | 4): void => {
        const sessions = sessionsRef.current;
        if (!sessions || pausedRef.current || eliminatedRef.current[player - 1]) return;
        if (audioEngine.countInRemaining() > 0.01) return;
        const time = calibratedTime(controllerTime(), settingsRef.current.calibrationMs);
        const session = player === 1 ? sessions[0] : sessions[1];
        processEvents(player, session.pressFret(lane, time));
      },
      onFretUp: (player: InputPlayer, lane: 0 | 1 | 2 | 3 | 4): void => {
        const sessions = sessionsRef.current;
        if (!sessions) return;
        const session = player === 1 ? sessions[0] : sessions[1];
        session.releaseFret(
          lane,
          calibratedTime(controllerTime(), settingsRef.current.calibrationMs),
        );
      },
      onStrum: (player: InputPlayer): void => {
        const sessions = sessionsRef.current;
        if (!sessions || pausedRef.current || eliminatedRef.current[player - 1]) return;
        if (audioEngine.countInRemaining() > 0.01) return;
        const time = calibratedTime(controllerTime(), settingsRef.current.calibrationMs);
        const session = player === 1 ? sessions[0] : sessions[1];
        processEvents(player, session.strum(time));
      },
      onStarPower: (player: InputPlayer): void => {
        activateStarPower(player);
      },
      onWhammy: (player: InputPlayer, down: boolean): void => {
        const sessions = sessionsRef.current;
        if (!sessions) return;
        (player === 1 ? sessions[0] : sessions[1]).setWhammy(down);
      },
      onPause: (): void => {
        if (pausedRef.current) void resume();
        else void pause();
      },
    };
    const detachKeyboard = attachKeyboard(callbacks, 2);
    const gamepads = attachGamepads(
      {
        onFretDown: (player, lane) => callbacks.onFretDown(player, lane),
        onFretUp: (player, lane) => callbacks.onFretUp(player, lane),
        onStrum: (player) => callbacks.onStrum(player),
        onStarPower: (player) => callbacks.onStarPower(player),
        onWhammy: (player, down) => callbacks.onWhammy(player, down),
      },
      2,
    );
    return () => {
      detachKeyboard();
      gamepads.detach();
    };
  }, [started, activateStarPower, controllerTime, pause, processEvents, resume]);

  const autoplaySessions = useCallback(
    (time: number): void => {
      const sessions = sessionsRef.current;
      if (!sessions) return;
      sessions.forEach((session, index) => {
        const player = (index + 1) as 1 | 2;
        const snapshot = session.snapshot();
        if (snapshot.starPower >= 0.25 && !snapshot.starPowerActive) {
          processEvents(player, session.activateStarPower(time));
        }
        let noteIndex = 0;
        for (let index = 0; index < chart.notes.length; index += 1) {
          const note = chart.notes[index];
          const state = snapshot.noteStates[index];
          const shouldHit = player === 1 || noteIndex % 2 === 0;
          noteIndex += 1;
          if (!note || state?.status !== "pending") continue;
          if (!shouldHit || Math.abs(note.time - time) > 0.034) continue;
          let judged = false;
          for (const lane of note.lanes) {
            const events = session.pressFret(lane, time);
            if (events.some((event) => event.type === "judgement")) judged = true;
            processEvents(player, events);
          }
          if (!judged) processEvents(player, session.strum(time));
        }
      });
    },
    [chart.notes, processEvents],
  );

  useEffect(() => {
    if (!started) return;
    let raf = 0;
    const step = (): void => {
      raf = requestAnimationFrame(step);
      if (pausedRef.current || finalizedRef.current) return;
      const sessions = sessionsRef.current;
      if (!sessions) return;
      if (audioEngine.countInRemaining() <= 0.001) {
        const time = controllerTime();
        if (autoplayUntilRef.current > performance.now()) autoplaySessions(time);
        const snapshots: [GameSnapshot, GameSnapshot] = [
          sessions[0].snapshot(),
          sessions[1].snapshot(),
        ];
        for (let index = 0; index < 2; index += 1) {
          const player = (index + 1) as 1 | 2;
          if (eliminatedRef.current[index]) continue;
          const session = index === 0 ? sessions[0] : sessions[1];
          const events = session.update(time);
          processEvents(player, events);
          const snapshot = session.snapshot();
          if (snapshot.failed) {
            eliminatedRef.current[index] = true;
            if (index === 0) {
              if (failTimesRef.current[0] === Number.POSITIVE_INFINITY) {
                failTimesRef.current = [time, failTimesRef.current[1]];
              }
            } else if (failTimesRef.current[1] === Number.POSITIVE_INFINITY) {
              failTimesRef.current = [failTimesRef.current[0], time];
            }
          }
          if (index === 0) {
            p1SnapshotRef.current = snapshot;
            snapshots[0] = snapshot;
          } else {
            p2SnapshotRef.current = snapshot;
            snapshots[1] = snapshot;
          }
        }
        const bothDone =
          (eliminatedRef.current[0] || sessions[0].snapshot().finished) &&
          (eliminatedRef.current[1] || sessions[1].snapshot().finished);
        if (bothDone) {
          finishFaceOff();
          return;
        }
      } else {
        p1SnapshotRef.current = sessions[0].snapshot();
        p2SnapshotRef.current = sessions[1].snapshot();
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [started, autoplaySessions, controllerTime, finishFaceOff, processEvents]);

  useEffect(() => {
    if (!started) return;
    const timer = setInterval(() => {
      const sessions = sessionsRef.current;
      if (!sessions) return;
      const p1 = sessions[0].snapshot();
      const p2 = sessions[1].snapshot();
      setHud([p1, p2]);
      const beat = 60 / composed.arrangement.bpm;
      const remaining = audioEngine.countInRemaining();
      setCountIn(remaining > 0.03 ? Math.max(1, Math.ceil(remaining / beat)) : 0);
    }, 90);
    return () => clearInterval(timer);
  }, [started, composed.arrangement.bpm]);

  useEffect(() => {
    if (!started) return;
    const onVisibility = (): void => {
      if (document.hidden) void pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pause, started]);

  useEffect(() => {
    const cleanup = installTestBridge({
      finishRun: () => {
        if (startedRef.current) finishFaceOff();
      },
      failRun: () => {
        if (startedRef.current) finishFaceOff();
      },
      autoplay: (seconds = 10) => {
        autoplayUntilRef.current = performance.now() + seconds * 1000;
      },
      songTime: () => controllerTime(),
    });
    return cleanup;
  }, [controllerTime, finishFaceOff]);

  useEffect(
    () => () => {
      audioEngine.stopRun();
      startedRef.current = false;
    },
    [],
  );

  const rematch = (): void => {
    void startFaceOff();
  };

  const quitToSetup = (): void => {
    audioEngine.stopRun();
    startedRef.current = false;
    finalizedRef.current = true;
    setStarted(false);
    setPaused(false);
    setResult(null);
    setPhase("setup");
  };

  if (phase === "setup") {
    return (
      <div className="screen faceoff-screen">
        <header className="screen-heading">
          <div>
            <p className="eyebrow">Face-off</p>
            <h1>Two players. One chart. No mercy.</h1>
            <p>
              Local split-screen Pro Face-Off. Both players play the same chart at the same time
              with independent score, streak, multiplier, star power, and rock meter. First to fail
              is out; if both survive, the higher score wins.
            </p>
          </div>
          <div className="screen-heading__badge">
            <span>Local only</span>
            <span>2 keyboards or pads</span>
            <span>Same chart</span>
          </div>
        </header>

        <div className="faceoff-setup">
          <section className="panel" aria-labelledby="faceoff-song-title">
            <h2 id="faceoff-song-title">Choose the battleground</h2>
            <label className="field">
              <span className="field__label">Song</span>
              <select value={songId} onChange={(event) => setSongId(event.target.value)}>
                {SONGS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title} — {option.artist}
                  </option>
                ))}
              </select>
            </label>
            <DifficultyPicker
              value={difficulty}
              onChange={(next) => {
                setDifficulty(next);
                saveStore.rememberSelection("faceoff", next, songId);
              }}
              compact
            />
            <div className="faceoff-preview">
              <div className="faceoff-preview__art">
                <AlbumArt song={song} />
              </div>
              <div>
                <p className="eyebrow">{song.genre}</p>
                <h3>{song.title}</h3>
                <p>
                  {song.artist} · {song.bpm} BPM · {difficultyLabel(difficulty)}
                </p>
              </div>
            </div>
          </section>

          <section className="panel" aria-labelledby="faceoff-controls-title">
            <h2 id="faceoff-controls-title">Both hands on deck</h2>
            <div className="faceoff-controls">
              <div>
                <h3>Player 1</h3>
                <p>
                  <kbd>A S D F G</kbd> frets
                </p>
                <p>
                  <kbd>Space</kbd> strum
                </p>
                <p>
                  <kbd>Q</kbd> star power · <kbd>W</kbd> whammy
                </p>
              </div>
              <div>
                <h3>Player 2</h3>
                <p>
                  <kbd>H J K L ;</kbd> frets
                </p>
                <p>
                  <kbd>Right Shift</kbd> or <kbd>Enter</kbd> strum
                </p>
                <p>
                  <kbd>P</kbd> star power · <kbd>O</kbd> whammy
                </p>
              </div>
            </div>
            <p className="quiet-note">
              Standard-mapping gamepads work too: the first pad is P1 and the second is P2. Escape
              pauses both highways. A failed player&apos;s highway stops judging; the survivor
              finishes the song.
            </p>
            {audioError && (
              <div className="gate-error" role="alert">
                <strong>Audio couldn&apos;t start.</strong>
                <p>{audioError}</p>
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary btn-hero"
              onClick={() => void startFaceOff()}
              ref={startButtonRef}
            >
              <span className="btn-hero__kicker">Unlock audio &amp; split the screen</span>
              <span className="btn-hero__label">Start face-off</span>
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="faceoff-play" data-gameplay="1">
      <div className="faceoff-stage" ref={regionRef} tabIndex={-1}>
        <div className="faceoff-split">
          <div className="faceoff-side faceoff-side--p1">
            <GameCanvas
              chart={chart}
              song={song}
              settings={renderSettings}
              effects={effects[0]}
              snapshotRef={p1SnapshotRef}
              player={1}
              eliminated={eliminatedRef.current[0]}
              label={`Player 1 playfield for ${song.title}.`}
            />
            <MiniHud
              snapshot={hud[0]}
              player={1}
              label="Player 1"
              eliminated={eliminatedRef.current[0]}
              onStar={activateStarPower}
            />
          </div>
          <div className="faceoff-side faceoff-side--p2">
            <GameCanvas
              chart={chart}
              song={song}
              settings={renderSettings}
              effects={effects[1]}
              snapshotRef={p2SnapshotRef}
              player={2}
              eliminated={eliminatedRef.current[1]}
              label={`Player 2 playfield for ${song.title}.`}
            />
            <MiniHud
              snapshot={hud[1]}
              player={2}
              label="Player 2"
              eliminated={eliminatedRef.current[1]}
              onStar={activateStarPower}
            />
          </div>
        </div>
        <div className="faceoff-topbar">
          <button type="button" className="btn btn-ghost btn-small" onClick={pause}>
            Pause
          </button>
          <div>
            <span className="eyebrow">Face-off · {difficultyLabel(difficulty)}</span>
            <h1>{song.title}</h1>
          </div>
          <button type="button" className="btn btn-ghost btn-small" onClick={quitToSetup}>
            Quit
          </button>
        </div>
        {countIn > 0 && (
          <div className="count-in" aria-hidden="true">
            <span className="count-in__label">Count-in</span>
            <strong>{countIn}</strong>
            <span className="count-in__hint">Both players start together</span>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {hud[0] && hud[1]
            ? `Player 1 score ${hud[0].score}, rock ${Math.round(hud[0].rock * 100)} percent. Player 2 score ${hud[1].score}, rock ${Math.round(hud[1].rock * 100)} percent.`
            : "Face-off starting."}
        </p>

        {paused && (
          <div
            className="pause-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Face-off paused"
          >
            <div className="pause-panel">
              <p className="eyebrow">Paused</p>
              <h2>{song.title}</h2>
              <p>
                P1 {formatScore(pausedHud[0]?.score ?? 0)} · P2{" "}
                {formatScore(pausedHud[1]?.score ?? 0)}
              </p>
              <div className="pause-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void resume()}
                  ref={resumeRef}
                >
                  Resume
                </button>
                <button type="button" className="btn btn-secondary" onClick={rematch}>
                  Restart face-off
                </button>
                <button type="button" className="btn btn-ghost" onClick={quitToSetup}>
                  Quit to setup
                </button>
              </div>
            </div>
          </div>
        )}

        {audioError && (
          <div className="audio-error" role="alert">
            <div>
              <h2>Audio interrupted</h2>
              <p>{audioError}</p>
              <div className="pause-actions">
                <button type="button" className="btn btn-primary" onClick={rematch}>
                  Retry face-off
                </button>
                <button type="button" className="btn btn-ghost" onClick={quitToSetup}>
                  Back to setup
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === "done" && result && (
          <div
            className="faceoff-result"
            role="dialog"
            aria-modal="true"
            aria-label="Face-off result"
          >
            <p className="eyebrow">Face-off result</p>
            <h2>
              {result.winner === "draw" ? "Dead even." : `Player ${result.winner} takes the room.`}
            </h2>
            <div className="faceoff-result__scores">
              <div className={result.winner === 1 ? "is-winner" : ""}>
                <span>Player 1</span>
                <strong>{formatScore(result.p1.score)}</strong>
                <span>{Math.round(result.p1.accuracy * 100)}% accuracy</span>
                <span>{result.p1.failed ? "Failed out" : "Survived"}</span>
              </div>
              <div className={result.winner === 2 ? "is-winner" : ""}>
                <span>Player 2</span>
                <strong>{formatScore(result.p2.score)}</strong>
                <span>{Math.round(result.p2.accuracy * 100)}% accuracy</span>
                <span>{result.p2.failed ? "Failed out" : "Survived"}</span>
              </div>
            </div>
            <div className="pause-actions">
              <button type="button" className="btn btn-primary" onClick={rematch} ref={rematchRef}>
                Rematch
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setPhase("setup")}>
                Change song
              </button>
              <a className="btn btn-ghost" href="#/">
                Main menu
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
