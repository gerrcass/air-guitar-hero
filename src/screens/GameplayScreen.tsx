import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioEngineError, audioEngine } from "../audio/engine";
import { AlbumArt } from "../components/AlbumArt";
import { GameCanvas } from "../components/GameCanvas";
import { RunHud } from "../components/RunHud";
import { getComposedSong } from "../content/composer";
import { isPracticeLoopDue, sliceChartForPractice } from "../content/practice";
import { songById } from "../content/songs";
import { GameSession } from "../game/session";
import type { Chart, GameEvent, GameSnapshot } from "../game/types";
import { attachGamepads } from "../input/gamepad";
import { attachKeyboard, type InputPlayer } from "../input/keyboard";
import { RenderEffects } from "../render/effects";
import { starsForScore } from "../state/career";
import { navigate, type Route } from "../state/router";
import { setLastRun } from "../state/run";
import { approachSeconds, calibratedTime } from "../state/settings";
import { saveStore, useSave } from "../state/store";
import { useEffectiveSettings } from "../state/useReducedMotion";
import { installTestBridge } from "../testing/bridge";

type PlayRoute = Extract<Route, { name: "play" }>;

interface GameplayScreenProps {
  readonly route: PlayRoute;
}

function hubFor(mode: PlayRoute["mode"]): string {
  return mode === "career" ? "#/career" : mode === "practice" ? "#/practice" : "#/quickplay";
}

export function GameplayScreen({ route }: GameplayScreenProps): React.JSX.Element {
  const save = useSave();
  const settings = save.settings;
  const composed = useMemo(() => getComposedSong(route.songId), [route.songId]);
  const song = useMemo(() => songById(route.songId), [route.songId]);
  const baseChart = composed.charts[route.difficulty];
  const practice = route.mode === "practice";
  const requestedSection = practice
    ? (baseChart.sections.find((section) => section.id === route.sectionId) ?? null)
    : null;
  const practiceSlice = useMemo(
    () =>
      practice && requestedSection ? sliceChartForPractice(baseChart, requestedSection) : null,
    [practice, baseChart, requestedSection],
  );
  const chart: Chart = practiceSlice?.chart ?? baseChart;
  const speed = practice ? Math.min(1, Math.max(0.5, route.speed ?? 1)) : 1;
  const startSongTime = practiceSlice ? practiceSlice.startSongTime : 0;
  const firstNoteTime = baseChart.notes[0]?.time ?? 0;
  const fullStartTime = practice
    ? 0
    : Math.max(0, firstNoteTime - approachSeconds(settings.noteSpeed));
  const sessionStart = practice ? 0 : fullStartTime;
  const sectionLabel = practiceSlice?.label;
  const audioStartTime = practice ? startSongTime : fullStartTime;

  const renderSettings = useEffectiveSettings(settings);

  const makeSession = useCallback(
    () =>
      new GameSession(chart, {
        difficulty: route.difficulty,
        noFail: practice || settings.noFail,
        startTime: sessionStart,
      }),
    [chart, route.difficulty, practice, settings.noFail, sessionStart],
  );

  const initialSession = useMemo(() => makeSession(), [makeSession]);
  const sessionRef = useRef<GameSession>(initialSession);
  const snapshotRef = useRef<GameSnapshot>(initialSession.snapshot());
  const effects = useMemo(() => new RenderEffects(), []);
  const [hud, setHud] = useState<GameSnapshot>(() => initialSession.snapshot());
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [countIn, setCountIn] = useState(0);
  const [loopEnabled, setLoopEnabled] = useState(route.loop ?? true);
  const [loopCount, setLoopCount] = useState(0);
  const [liveText, setLiveText] = useState("");

  const startedRef = useRef(false);
  const pausedRef = useRef(false);
  const endedRef = useRef(false);
  const finalizedRef = useRef(false);
  const loopEnabledRef = useRef(loopEnabled);
  const loopBusyRef = useRef(false);
  const autoplayUntilRef = useRef(0);
  const settingsRef = useRef(settings);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const pauseResumeRef = useRef<HTMLButtonElement>(null);
  const gameRegionRef = useRef<HTMLDivElement>(null);
  const liveTickRef = useRef(0);
  const lastSfxRef = useRef(0);

  useEffect(() => {
    settingsRef.current = settings;
    audioEngine.setVolumes(settings);
  }, [settings]);
  useEffect(() => {
    loopEnabledRef.current = loopEnabled;
  }, [loopEnabled]);
  useEffect(() => {
    if (!started) startButtonRef.current?.focus();
  }, [started]);
  useEffect(() => {
    if (paused) pauseResumeRef.current?.focus();
  }, [paused]);

  const controllerTime = useCallback((): number => {
    const raw = audioEngine.now();
    return practice ? raw - startSongTime : raw;
  }, [practice, startSongTime]);

  const finalizeRun = useCallback(
    (
      snapshot: GameSnapshot,
      options: {
        readonly abandoned?: boolean;
        readonly override?: { readonly passed: boolean; readonly scoreRatio?: number };
      } = {},
    ): void => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      endedRef.current = true;
      audioEngine.stopRun();
      const passed =
        options.override?.passed ??
        (practice ? !snapshot.failed : !options.abandoned && snapshot.finished && !snapshot.failed);
      const score = options.override
        ? Math.round(chart.parScore * (options.override.scoreRatio ?? 0.85))
        : snapshot.score;
      const accuracy = options.override
        ? passed
          ? 0.94
          : Math.max(0, snapshot.accuracy)
        : snapshot.accuracy;
      const maxStreak = options.override
        ? Math.round(chart.notes.length * (passed ? 0.82 : 0.2))
        : snapshot.maxStreak;
      const hits =
        snapshot.judgeCounts.perfect + snapshot.judgeCounts.great + snapshot.judgeCounts.good;
      const stars = starsForScore(score, chart.parScore, passed);
      const recorded =
        practice || route.mode === "faceoff"
          ? null
          : saveStore.recordRun({
              mode: route.mode,
              songId: song.id,
              difficulty: route.difficulty,
              score,
              parScore: chart.parScore,
              passed,
              accuracy,
              maxStreak,
              notesHit: hits,
            });
      setLastRun({
        mode: route.mode,
        songId: song.id,
        difficulty: route.difficulty,
        score,
        accuracy,
        maxStreak,
        judgeCounts: { ...snapshot.judgeCounts },
        passed,
        stars,
        newBest: recorded?.newBest ?? false,
        sustainTicks: snapshot.sustainTicks,
        starPowerActivations: snapshot.starPowerActivations,
        totalNotes: snapshot.totalNotes,
        ...(sectionLabel ? { sectionLabel } : {}),
        ...(practice ? { practiceSpeed: speed } : {}),
      });
      navigate("#/results");
    },
    [
      chart.parScore,
      chart.notes.length,
      practice,
      route.mode,
      route.difficulty,
      song.id,
      sectionLabel,
      speed,
    ],
  );

  const processEvents = useCallback(
    (events: readonly GameEvent[]): void => {
      for (const event of events) {
        effects.push(event);
        const now = performance.now();
        if (event.type === "judgement") {
          if (now - lastSfxRef.current > 18 || event.judgement === "miss") {
            audioEngine.playJudgement(event.judgement, sessionRef.current.snapshot().streak);
            lastSfxRef.current = now;
          }
        } else if (event.type === "overstrum") {
          audioEngine.playOverstrum();
        } else if (event.type === "starPowerActivated" || event.type === "starPhrase") {
          audioEngine.playStarPower();
        } else if (event.type === "failed") {
          const snapshot = sessionRef.current.snapshot();
          finalizeRun(snapshot);
          return;
        } else if (event.type === "finished") {
          finalizeRun(sessionRef.current.snapshot());
          return;
        }
      }
    },
    [effects, finalizeRun],
  );

  const restartLoop = useCallback((): void => {
    if (loopBusyRef.current) return;
    loopBusyRef.current = true;
    const session = makeSession();
    sessionRef.current = session;
    snapshotRef.current = session.snapshot();
    effects.clear();
    setHud(session.snapshot());
    setLoopCount((count) => count + 1);
    audioEngine.stopRun();
    void audioEngine
      .startRun(composed.arrangement, {
        startTime: audioStartTime,
        speed,
        countInBeats: 0,
      })
      .catch((error: unknown) => {
        setAudioError(
          error instanceof AudioEngineError
            ? error.message
            : "Audio could not start. Check browser permissions and retry.",
        );
      })
      .finally(() => {
        loopBusyRef.current = false;
      });
  }, [audioStartTime, composed.arrangement, effects, makeSession, speed]);

  const startRun = useCallback(async (): Promise<void> => {
    setAudioError(null);
    finalizedRef.current = false;
    endedRef.current = false;
    pausedRef.current = false;
    setPaused(false);
    const session = makeSession();
    sessionRef.current = session;
    snapshotRef.current = session.snapshot();
    setHud(session.snapshot());
    effects.clear();
    setLoopCount(0);
    try {
      await audioEngine.unlock();
      audioEngine.setVolumes(settingsRef.current);
      await audioEngine.startRun(composed.arrangement, {
        startTime: audioStartTime,
        speed,
        countInBeats: 4,
      });
      startedRef.current = true;
      setStarted(true);
      window.setTimeout(() => gameRegionRef.current?.focus(), 0);
    } catch (error) {
      startedRef.current = false;
      setStarted(false);
      setAudioError(
        error instanceof AudioEngineError
          ? error.message
          : "Audio could not start. Check your browser's sound permissions and retry.",
      );
    }
  }, [audioStartTime, composed.arrangement, effects, makeSession, speed]);

  const pause = useCallback(async (): Promise<void> => {
    if (!startedRef.current || pausedRef.current || finalizedRef.current) return;
    pausedRef.current = true;
    setPaused(true);
    const session = sessionRef.current;
    const time = controllerTime();
    for (let lane = 0; lane < 5; lane += 1) session.releaseFret(lane as 0 | 1 | 2 | 3 | 4, time);
    session.setWhammy(false);
    try {
      await audioEngine.pause();
      setLiveText("Paused. Press Escape or Resume to continue.");
    } catch {
      setLiveText("Pause requested. Audio may still be running.");
    }
  }, [controllerTime]);

  const resume = useCallback(async (): Promise<void> => {
    if (!pausedRef.current) return;
    try {
      await audioEngine.resume();
      pausedRef.current = false;
      setPaused(false);
      setLiveText("Resumed.");
    } catch (error) {
      setAudioError(
        error instanceof AudioEngineError
          ? error.message
          : "Audio could not resume. Retry the run from the pause menu.",
      );
    }
  }, []);

  const togglePause = useCallback((): void => {
    if (pausedRef.current) void resume();
    else void pause();
  }, [pause, resume]);

  const activateStarPower = useCallback((): void => {
    if (pausedRef.current || finalizedRef.current) return;
    const time = calibratedTime(controllerTime(), settingsRef.current.calibrationMs);
    const events = sessionRef.current.activateStarPower(time);
    processEvents(events);
  }, [controllerTime, processEvents]);

  const quit = useCallback((): void => {
    audioEngine.stopRun();
    navigate(hubFor(route.mode));
  }, [route.mode]);

  const abandonRun = useCallback((): void => {
    finalizeRun(sessionRef.current.snapshot(), { abandoned: true });
  }, [finalizeRun]);

  useEffect(() => {
    if (!started) return;
    const callbacks = {
      onFretDown: (player: InputPlayer, lane: 0 | 1 | 2 | 3 | 4): void => {
        if (pausedRef.current || finalizedRef.current || player !== 1) return;
        if (audioEngine.countInRemaining() > 0.01) return;
        const time = calibratedTime(controllerTime(), settingsRef.current.calibrationMs);
        processEvents(sessionRef.current.pressFret(lane, time));
      },
      onFretUp: (player: InputPlayer, lane: 0 | 1 | 2 | 3 | 4): void => {
        if (player !== 1) return;
        sessionRef.current.releaseFret(
          lane,
          calibratedTime(controllerTime(), settingsRef.current.calibrationMs),
        );
      },
      onStrum: (player: InputPlayer): void => {
        if (pausedRef.current || finalizedRef.current || player !== 1) return;
        if (audioEngine.countInRemaining() > 0.01) return;
        const time = calibratedTime(controllerTime(), settingsRef.current.calibrationMs);
        processEvents(sessionRef.current.strum(time));
      },
      onStarPower: (player: InputPlayer): void => {
        if (player !== 1) return;
        activateStarPower();
      },
      onWhammy: (player: InputPlayer, down: boolean): void => {
        if (player !== 1) return;
        sessionRef.current.setWhammy(down);
      },
      onPause: (): void => togglePause(),
    };
    const detachKeyboard = attachKeyboard(callbacks, 1);
    const gamepads = attachGamepads(
      {
        onFretDown: (player, lane) => callbacks.onFretDown(player, lane),
        onFretUp: (player, lane) => callbacks.onFretUp(player, lane),
        onStrum: (player) => callbacks.onStrum(player),
        onStarPower: (player) => callbacks.onStarPower(player),
        onWhammy: (player, down) => callbacks.onWhammy(player, down),
      },
      1,
    );
    return () => {
      detachKeyboard();
      gamepads.detach();
    };
  }, [started, activateStarPower, controllerTime, processEvents, togglePause]);

  useEffect(() => {
    if (!started) return;
    const onVisibility = (): void => {
      if (document.hidden) void pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pause, started]);

  const autoplayHit = useCallback(
    (time: number): void => {
      const session = sessionRef.current;
      const snapshot = session.snapshot();
      const events: GameEvent[] = [];
      if (snapshot.starPower >= 0.25 && !snapshot.starPowerActive) {
        events.push(...session.activateStarPower(time));
      }
      for (let index = 0; index < chart.notes.length; index += 1) {
        const note = chart.notes[index];
        const state = snapshot.noteStates[index];
        if (!note || state?.status !== "pending") continue;
        if (Math.abs(note.time - time) <= 0.034) {
          let judged = false;
          for (const lane of note.lanes) {
            const fretEvents = session.pressFret(lane, time);
            if (fretEvents.some((event) => event.type === "judgement")) judged = true;
            events.push(...fretEvents);
          }
          if (!judged) events.push(...session.strum(time));
        }
      }
      if (events.length > 0) processEvents(events);
    },
    [chart.notes, processEvents],
  );

  useEffect(() => {
    if (!started) return;
    let raf = 0;
    const step = (): void => {
      raf = requestAnimationFrame(step);
      if (pausedRef.current || finalizedRef.current) return;
      const session = sessionRef.current;
      if (audioEngine.countInRemaining() <= 0.001) {
        const time = controllerTime();
        if (practice && loopEnabledRef.current && isPracticeLoopDue(time, chart.duration)) {
          restartLoop();
          return;
        }
        if (autoplayUntilRef.current > performance.now()) {
          autoplayHit(time);
        }
        processEvents(session.update(time));
        const snapshot = session.snapshot();
        snapshotRef.current = snapshot;
        if (snapshot.failed || snapshot.finished) {
          finalizeRun(snapshot);
          return;
        }
      } else {
        snapshotRef.current = session.snapshot();
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [
    started,
    autoplayHit,
    chart.duration,
    controllerTime,
    finalizeRun,
    practice,
    processEvents,
    restartLoop,
  ]);

  useEffect(() => {
    if (!started) return;
    const beat = 60 / composed.arrangement.bpm;
    const timer = setInterval(() => {
      const snapshot = snapshotRef.current;
      setHud(snapshot);
      const remaining = audioEngine.countInRemaining();
      setCountIn(remaining > 0.03 ? Math.max(1, Math.ceil(remaining / beat)) : 0);
      liveTickRef.current += 1;
      if (liveTickRef.current % 12 === 0 && !pausedRef.current) {
        setLiveText(
          `Score ${snapshot.score}. Streak ${snapshot.streak}. Multiplier ${snapshot.multiplier}. Rock ${Math.round(
            snapshot.rock * 100,
          )} percent. ${
            snapshot.starPowerActive
              ? "Star power active."
              : snapshot.starPower >= 0.25
                ? "Star power ready."
                : ""
          }`,
        );
      }
    }, 90);
    return () => clearInterval(timer);
  }, [composed.arrangement.bpm, started]);

  useEffect(() => {
    const cleanup = installTestBridge({
      finishRun: (options = {}) => {
        if (!startedRef.current) return;
        finalizeRun(snapshotRef.current, {
          override: {
            passed: options.passed ?? true,
            ...(options.scoreRatio !== undefined ? { scoreRatio: options.scoreRatio } : {}),
          },
        });
      },
      completeRun: () => {
        if (!startedRef.current) return;
        const session = sessionRef.current;
        for (let index = 0; index < chart.notes.length; index += 1) {
          const note = chart.notes[index];
          const state = session.snapshot().noteStates[index];
          if (!note || state?.status !== "pending") continue;
          let judged = false;
          for (const lane of note.lanes) {
            const events = session.pressFret(lane, note.time);
            if (events.some((event) => event.type === "judgement")) judged = true;
          }
          if (!judged) session.strum(note.time);
          if (note.duration > 0) {
            session.update(note.time + note.duration);
          }
          for (const lane of note.lanes)
            session.releaseFret(lane, note.time + note.duration + 0.01);
          if (session.snapshot().starPower >= 0.25 && !session.snapshot().starPowerActive) {
            session.activateStarPower(note.time + note.duration + 0.02);
          }
        }
        session.update(chart.duration + 0.1);
        finalizeRun(session.snapshot());
      },
      failRun: () => {
        if (!startedRef.current) return;
        finalizeRun(snapshotRef.current, { override: { passed: false, scoreRatio: 0.08 } });
      },
      autoplay: (seconds = 10) => {
        autoplayUntilRef.current = performance.now() + seconds * 1000;
      },
      songTime: () => controllerTime(),
    });
    return cleanup;
  }, [controllerTime, finalizeRun, chart.notes, chart.duration]);

  useEffect(
    () => () => {
      audioEngine.stopRun();
      startedRef.current = false;
    },
    [],
  );

  if (started) {
    return (
      <div className="gameplay-screen" data-gameplay="1">
        <section
          className="gameplay-stage"
          ref={gameRegionRef}
          tabIndex={-1}
          aria-label={`${song.title} gameplay`}
        >
          <GameCanvas
            chart={chart}
            song={song}
            settings={renderSettings}
            effects={effects}
            snapshotRef={snapshotRef}
            player={1}
            label={`Playfield for ${song.title}. Five lanes: green, red, yellow, blue, orange.`}
          />
          <RunHud
            snapshot={hud}
            song={song}
            difficulty={route.difficulty}
            {...(sectionLabel ? { sectionLabel } : {})}
            paused={paused}
            onPause={togglePause}
            onStarPower={activateStarPower}
          />
          {practice && (
            <div className="practice-run-bar">
              <span>
                Practice · {Math.round(speed * 100)}% · loop {loopEnabled ? "on" : "off"}
                {loopCount > 0 ? ` · pass ${loopCount + 1}` : ""}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => setLoopEnabled((value) => !value)}
                aria-pressed={loopEnabled}
              >
                {loopEnabled ? "Turn loop off" : "Turn loop on"}
              </button>
            </div>
          )}
          {countIn > 0 && (
            <div className="count-in" aria-hidden="true">
              <span className="count-in__label">Count-in</span>
              <strong>{countIn}</strong>
              <span className="count-in__hint">First note is on the highway</span>
            </div>
          )}
          <p className="sr-only" aria-live="polite">
            {liveText}
          </p>
          {paused && (
            <div className="pause-overlay" role="dialog" aria-modal="true" aria-label="Run paused">
              <div className="pause-panel">
                <p className="eyebrow">Paused</p>
                <h2>{song.title}</h2>
                <p>
                  {snapshotRef.current.score.toLocaleString("en-US")} points ·{" "}
                  {snapshotRef.current.streak} streak · {Math.round(snapshotRef.current.rock * 100)}
                  % rock
                </p>
                <div className="pause-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void resume()}
                    ref={pauseResumeRef}
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void startRun()}
                  >
                    Restart
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={abandonRun}>
                    End run &amp; see results
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={quit}>
                    Quit to {route.mode === "career" ? "career" : "quickplay"}
                  </button>
                </div>
                {practice && (
                  <div className="pause-practice">
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      onClick={() => setLoopEnabled((value) => !value)}
                      aria-pressed={loopEnabled}
                    >
                      Loop: {loopEnabled ? "on" : "off"}
                    </button>
                    <span>Speed {Math.round(speed * 100)}% · no fail</span>
                  </div>
                )}
                <p className="quiet-note">
                  Escape resumes. Switching tabs pauses automatically; the chart never
                  fast-forwards.
                </p>
              </div>
            </div>
          )}
          {audioError && (
            <div className="audio-error" role="alert">
              <div>
                <h2>Audio interrupted</h2>
                <p>{audioError}</p>
                <div className="pause-actions">
                  <button type="button" className="btn btn-primary" onClick={() => void startRun()}>
                    Retry audio
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={quit}>
                    Back to menu
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="gameplay-gate" data-gameplay="1">
      <a className="gate-back" href={hubFor(route.mode)}>
        ← {route.mode === "career" ? "Career" : "Quickplay"}
      </a>
      <div className="gate-layout">
        <div className="gate-art">
          <AlbumArt song={song} />
        </div>
        <div className="gate-panel">
          <p className="eyebrow">
            {practice ? "Practice" : route.mode === "career" ? "Career" : "Quickplay"} ·{" "}
            {route.difficulty}
            {sectionLabel ? ` · ${sectionLabel}` : ""}
          </p>
          <h1>{song.title}</h1>
          <p className="gate-artist">{song.artist}</p>
          <p className="gate-meta">
            {song.genre} · {song.bpm} BPM · {song.album}
            {practice ? ` · ${Math.round(speed * 100)}% speed` : ""}
          </p>
          <p className="gate-copy">
            {practice
              ? "No fail, no saved scores. Loop restarts audio and chart together at the section boundary."
              : "Hold the five frets. Strum on the line. Star phrases fill the meter; Q or Enter spends it."}
          </p>
          <div className="gate-controls">
            <span>
              <kbd>A S D F G</kbd> frets
            </span>
            <span>
              <kbd>Space</kbd> strum
            </span>
            <span>
              <kbd>Q</kbd> star power
            </span>
            <span>
              <kbd>W</kbd> whammy
            </span>
            <span>
              <kbd>Esc</kbd> pause
            </span>
          </div>
          {practice && (
            <p className="quiet-note">
              Section {sectionLabel ?? "custom"} · loop {loopEnabled ? "on" : "off"} · practice
              never writes career progress or quickplay bests.
            </p>
          )}
          {audioError && (
            <div className="gate-error" role="alert">
              <strong>Audio couldn't start.</strong>
              <p>{audioError}</p>
            </div>
          )}
          <div className="gate-actions">
            <button
              type="button"
              className="btn btn-primary btn-hero"
              onClick={() => void startRun()}
              ref={startButtonRef}
            >
              <span className="btn-hero__kicker">Unlock audio &amp; play</span>
              <span className="btn-hero__label">Start run</span>
            </button>
            <a className="btn btn-ghost" href="#/settings">
              Calibration &amp; settings
            </a>
          </div>
          <p className="quiet-note">
            Clicking Start unlocks Web Audio. Keep the tab visible while you play; hiding it pauses
            the run.
          </p>
        </div>
      </div>
    </div>
  );
}
