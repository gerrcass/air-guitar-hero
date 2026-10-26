import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioEngineError, audioEngine } from "../audio/engine";
import { GameCanvas } from "../components/GameCanvas";
import { Meter } from "../components/Meter";
import { useFocusTrap } from "../components/useFocusTrap";
import type { TutorialLesson } from "../content/tutorial";
import { TUTORIAL_LESSONS } from "../content/tutorial";
import { GameSession } from "../game/session";
import type { GameEvent, GameSnapshot } from "../game/types";
import { attachGamepads } from "../input/gamepad";
import { attachKeyboard, type InputPlayer } from "../input/keyboard";
import { RenderEffects } from "../render/effects";
import { calibratedTime } from "../state/settings";
import { saveStore, useSave } from "../state/store";
import { useEffectiveSettings } from "../state/useReducedMotion";
import { installTestBridge } from "../testing/bridge";

interface LessonOutcome {
  readonly passed: boolean;
  readonly score: number;
  readonly accuracy: number;
  readonly starActivations: number;
}

export function TutorialScreen(): React.JSX.Element {
  const save = useSave();
  const settings = save.settings;
  const renderSettings = useEffectiveSettings(settings);
  const [phase, setPhase] = useState<"select" | "playing" | "done">("select");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(
    () => new Set(save.tutorialComplete ? TUTORIAL_LESSONS.map((lesson) => lesson.id) : []),
  );
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [countIn, setCountIn] = useState(0);
  const [hud, setHud] = useState<GameSnapshot | null>(null);
  const [outcome, setOutcome] = useState<LessonOutcome | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [pausedSnapshot, setPausedSnapshot] = useState<GameSnapshot | null>(null);

  const activeLesson = useMemo(
    () => TUTORIAL_LESSONS.find((lesson) => lesson.id === activeId) ?? null,
    [activeId],
  );
  const effects = useMemo(() => new RenderEffects(), []);
  const sessionRef = useRef<GameSession | null>(null);
  const snapshotRef = useRef<GameSnapshot | null>(null);
  const startedRef = useRef(false);
  const pausedRef = useRef(false);
  const phaseRef = useRef(phase);
  const activeRef = useRef<TutorialLesson | null>(null);
  const hopoHitsRef = useRef(0);
  const finalizedRef = useRef(false);
  const settingsRef = useRef(settings);
  const regionRef = useRef<HTMLDivElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const pauseDialogRef = useRef<HTMLDivElement>(null);
  const outcomeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    settingsRef.current = settings;
    audioEngine.setVolumes(settings);
  }, [settings]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    activeRef.current = activeLesson;
  }, [activeLesson]);
  useEffect(() => {
    if (phase === "done") nextButtonRef.current?.focus();
  }, [phase]);
  useEffect(() => {
    if (paused) resumeRef.current?.focus();
  }, [paused]);
  useFocusTrap(pauseDialogRef, paused);
  useFocusTrap(outcomeRef, phase === "done");
  useEffect(() => {
    const active = phase === "playing" && started && !paused;
    document.documentElement.dataset.gameplayActive = active ? "1" : "0";
    return () => {
      delete document.documentElement.dataset.gameplayActive;
    };
  }, [phase, started, paused]);

  const controllerTime = useCallback(() => audioEngine.now(), []);
  const judgeTime = useCallback(
    () => calibratedTime(controllerTime(), settingsRef.current.calibrationMs),
    [controllerTime],
  );

  const finishLesson = useCallback(
    (lesson: TutorialLesson, snapshot: GameSnapshot, forcedPass = false): void => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      audioEngine.stopRun();
      const accuracy = snapshot.accuracy;
      const starPass = !lesson.requiresStarActivation || snapshot.starPowerActivations > 0;
      const hopoPass = lesson.id !== "hopo" || hopoHitsRef.current > 0;
      const sustainPass = lesson.id !== "sustains" || snapshot.sustainTicks > 0;
      const passed = forcedPass || (accuracy >= 0.5 && starPass && hopoPass && sustainPass);
      setOutcome({
        passed,
        score: snapshot.score,
        accuracy,
        starActivations: snapshot.starPowerActivations,
      });
      setPhase("done");
      setPaused(false);
      pausedRef.current = false;
      if (passed) {
        setCompleted((previous) => {
          const next = new Set(previous);
          next.add(lesson.id);
          if (next.size >= TUTORIAL_LESSONS.length) saveStore.completeTutorial();
          return next;
        });
      }
    },
    [],
  );

  const processEvents = useCallback(
    (_lesson: TutorialLesson, events: readonly GameEvent[]): void => {
      for (const event of events) {
        effects.push(event);
        if (event.type === "judgement") {
          if (event.hopoHit === true) hopoHitsRef.current += 1;
          audioEngine.playJudgement(event.judgement);
        } else if (event.type === "overstrum") {
          audioEngine.playOverstrum();
        } else if (event.type === "starPowerActivated") {
          audioEngine.playStarPower();
        }
      }
    },
    [effects],
  );

  const beginLesson = useCallback(
    async (lesson: TutorialLesson): Promise<void> => {
      setAudioError(null);
      setOutcome(null);
      setStarted(false);
      startedRef.current = false;
      pausedRef.current = false;
      setPaused(false);
      finalizedRef.current = false;
      hopoHitsRef.current = 0;
      setActiveId(lesson.id);
      setPhase("playing");
      const session = new GameSession(lesson.chart, {
        difficulty: lesson.difficulty,
        noFail: true,
        hopoEnabled: settingsRef.current.hopoRelief,
      });
      sessionRef.current = session;
      snapshotRef.current = session.snapshot();
      setHud(session.snapshot());
      effects.clear();
      try {
        await audioEngine.unlock();
        audioEngine.setVolumes(settingsRef.current);
        await audioEngine.startRun(lesson.arrangement, {
          startTime: 0,
          speed: 1,
          countInBeats: 4,
        });
        startedRef.current = true;
        setStarted(true);
        window.setTimeout(() => regionRef.current?.focus(), 0);
      } catch (error) {
        setAudioError(
          error instanceof AudioEngineError
            ? error.message
            : "Audio could not start. Check your browser's sound permissions and retry.",
        );
      }
    },
    [effects],
  );

  const pause = useCallback(async (): Promise<void> => {
    if (!startedRef.current || pausedRef.current || phaseRef.current !== "playing") return;
    pausedRef.current = true;
    setPaused(true);
    setPausedSnapshot(snapshotRef.current);
    try {
      await audioEngine.pause();
    } catch {
      // The overlay still holds the run.
    }
  }, []);

  const resume = useCallback(async (): Promise<void> => {
    if (!pausedRef.current) return;
    try {
      await audioEngine.resume();
      pausedRef.current = false;
      setPaused(false);
    } catch {
      setAudioError("Audio could not resume. Restart the lesson.");
    }
  }, []);

  useEffect(() => {
    if (!paused) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      void resume();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paused, resume]);

  const leave = useCallback((): void => {
    audioEngine.stopRun();
    startedRef.current = false;
    setStarted(false);
    setActiveId(null);
    setPhase("select");
    setOutcome(null);
  }, []);

  const activateStarPower = useCallback((): void => {
    const session = sessionRef.current;
    const lesson = activeRef.current;
    if (!session || !lesson || pausedRef.current) return;
    const events = session.activateStarPower(judgeTime());
    processEvents(lesson, events);
  }, [judgeTime, processEvents]);

  useEffect(() => {
    if (!started || !activeLesson || phase !== "playing" || paused) return;
    const callbacks = {
      onFretDown: (player: InputPlayer, lane: 0 | 1 | 2 | 3 | 4): void => {
        if (player !== 1 || pausedRef.current || !sessionRef.current) return;
        if (audioEngine.countInRemaining() > 0.01) return;
        const time = judgeTime();
        processEvents(activeLesson, sessionRef.current.pressFret(lane, time));
      },
      onFretUp: (player: InputPlayer, lane: 0 | 1 | 2 | 3 | 4): void => {
        if (player !== 1) return;
        sessionRef.current?.releaseFret(lane, judgeTime());
      },
      onStrum: (player: InputPlayer): void => {
        if (player !== 1 || pausedRef.current || !sessionRef.current) return;
        if (audioEngine.countInRemaining() > 0.01) return;
        const time = judgeTime();
        processEvents(activeLesson, sessionRef.current.strum(time));
      },
      onStarPower: (player: InputPlayer): void => {
        if (player === 1) activateStarPower();
      },
      onWhammy: (player: InputPlayer, down: boolean): void => {
        if (player === 1) sessionRef.current?.setWhammy(down);
      },
      onPause: (): void => {
        if (pausedRef.current) void resume();
        else void pause();
      },
    };
    const detachKeyboard = attachKeyboard(callbacks, 1);
    const gamepads = attachGamepads(
      {
        onFretDown: (player, lane) => callbacks.onFretDown(player, lane),
        onFretUp: (player, lane) => callbacks.onFretUp(player, lane),
        onStrum: (player) => callbacks.onStrum(player),
        onStarPower: (player) => callbacks.onStarPower(player),
        onPause: callbacks.onPause,
        onWhammy: (player, down) => callbacks.onWhammy(player, down),
      },
      1,
    );
    return () => {
      detachKeyboard();
      gamepads.detach();
    };
  }, [
    started,
    activeLesson,
    phase,
    paused,
    activateStarPower,
    judgeTime,
    pause,
    processEvents,
    resume,
  ]);

  useEffect(() => {
    if (!started || !activeLesson || phase !== "playing") return;
    let raf = 0;
    const step = (): void => {
      raf = requestAnimationFrame(step);
      if (pausedRef.current || finalizedRef.current) return;
      const session = sessionRef.current;
      if (!session) return;
      if (audioEngine.countInRemaining() <= 0.001) {
        const time = judgeTime();
        processEvents(activeLesson, session.update(time));
        const snapshot = session.snapshot();
        snapshotRef.current = snapshot;
        if (snapshot.finished) {
          finishLesson(activeLesson, snapshot);
          return;
        }
      } else if (sessionRef.current) {
        snapshotRef.current = sessionRef.current.snapshot();
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [started, activeLesson, phase, judgeTime, finishLesson, processEvents]);

  useEffect(() => {
    if (!started || !activeLesson) return;
    const beat = 60 / activeLesson.arrangement.bpm;
    const timer = setInterval(() => {
      const snapshot = snapshotRef.current;
      if (snapshot) setHud(snapshot);
      const remaining = audioEngine.countInRemaining();
      setCountIn(remaining > 0.03 ? Math.max(1, Math.ceil(remaining / beat)) : 0);
    }, 90);
    return () => clearInterval(timer);
  }, [started, activeLesson]);

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
      completeLesson: () => {
        const lesson = activeRef.current;
        const session = sessionRef.current;
        if (phaseRef.current === "playing" && lesson && session) {
          finishLesson(lesson, session.snapshot(), true);
        }
      },
      completeTutorial: () => {
        saveStore.completeTutorial();
        setCompleted(new Set(TUTORIAL_LESSONS.map((lesson) => lesson.id)));
        audioEngine.stopRun();
        setStarted(false);
        setActiveId(null);
        setPhase("select");
      },
    });
    return cleanup;
  }, [finishLesson]);

  useEffect(
    () => () => {
      audioEngine.stopRun();
      startedRef.current = false;
    },
    [],
  );

  const nextLesson = activeLesson
    ? (TUTORIAL_LESSONS.find((lesson) => lesson.index === activeLesson.index + 1) ?? null)
    : null;

  const skipLesson = (): void => {
    if (nextLesson) void beginLesson(nextLesson);
    else leave();
  };

  if (phase === "select") {
    const doneCount = completed.size;
    const allDone = doneCount >= TUTORIAL_LESSONS.length;
    return (
      <div className="screen tutorial-screen">
        <header className="screen-heading">
          <div>
            <p className="eyebrow">Tutorial</p>
            <h1>Five reps to the first chorus</h1>
            <p>
              Each lesson is a short, no-fail rep with a specific instruction. Complete all five
              once to mark the tutorial finished; every lesson stays replayable.
            </p>
          </div>
          <div className="tutorial-progress">
            <span className="tutorial-progress__value">
              {doneCount}/{TUTORIAL_LESSONS.length}
            </span>
            <span className="tutorial-progress__label">lessons complete</span>
            {allDone && <span className="tutorial-progress__badge">Tutorial complete</span>}
          </div>
        </header>

        {allDone && (
          <div className="tutorial-banner" role="status">
            <strong>Tutorial complete.</strong> The marker is saved on this device. Replay any
            lesson, or take the controls into Quickplay.
            <a className="text-link" href="#/quickplay">
              Quickplay →
            </a>
          </div>
        )}

        <div className="lesson-grid">
          {TUTORIAL_LESSONS.map((lesson) => {
            const done = completed.has(lesson.id);
            return (
              <article className={`lesson-card${done ? " lesson-card--done" : ""}`} key={lesson.id}>
                <div className="lesson-card__top">
                  <span className="lesson-card__index">
                    {String(lesson.index + 1).padStart(2, "0")}
                  </span>
                  <span className="lesson-card__status">{done ? "Complete" : "Not played"}</span>
                </div>
                <h2>{lesson.title}</h2>
                <p>{lesson.instruction}</p>
                <p className="lesson-card__hint">{lesson.successHint}</p>
                <div className="lesson-card__footer">
                  <span>{lesson.difficulty}</span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void beginLesson(lesson)}
                  >
                    {done ? "Replay" : "Start lesson"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        <p className="quiet-note">
          Lessons use the same judgement engine as songs. Practice and tutorial runs never fail and
          never write career or best-score records.
        </p>
      </div>
    );
  }

  if (!activeLesson) return <p>Loading lesson…</p>;

  return (
    <div className="tutorial-play" data-gameplay="1">
      <div className="tutorial-play__stage" ref={regionRef} tabIndex={-1}>
        <GameCanvas
          chart={activeLesson.chart}
          song={activeLesson.song}
          settings={renderSettings}
          effects={effects}
          snapshotRef={snapshotRef}
          player={1}
          label={`Tutorial playfield for ${activeLesson.title}.`}
        />
        <header className="tutorial-top">
          <button type="button" className="btn btn-ghost btn-small" onClick={leave}>
            ← Lessons
          </button>
          <div className="tutorial-top__title">
            <span className="eyebrow">
              Lesson {activeLesson.index + 1} of {TUTORIAL_LESSONS.length}
            </span>
            <h1>{activeLesson.title}</h1>
          </div>
          <div className="tutorial-top__score">
            <span>Score</span>
            <strong>{hud?.score.toLocaleString("en-US") ?? "0"}</strong>
          </div>
          <button type="button" className="btn btn-ghost btn-small" onClick={skipLesson}>
            Skip
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => (paused ? void resume() : void pause())}
          >
            {paused ? "Resume" : "Pause"}
          </button>
        </header>
        <div className="tutorial-instruction" role="note">
          <strong>Your job:</strong> {activeLesson.instruction}
        </div>
        <div className="tutorial-meters">
          <Meter
            label="Star power"
            value={hud?.starPower ?? 0}
            tone="star"
            detail={
              (hud?.starPower ?? 0) >= 0.25 && !hud?.starPowerActive ? "Ready — press Q" : undefined
            }
          />
          <Meter
            label="Lesson"
            value={hud ? Math.min(1, Math.max(0, hud.time / activeLesson.chart.duration)) : 0}
            tone="progress"
          />
          <span className="tutorial-meters__accuracy">
            {hud && hud.judgedNotes > 0 ? `${Math.round(hud.accuracy * 100)}%` : "—"} accuracy
          </span>
          <button
            type="button"
            className={`btn btn-star btn-small${(hud?.starPower ?? 0) >= 0.25 && !hud?.starPowerActive ? " is-ready" : ""}`}
            onClick={activateStarPower}
            disabled={(hud?.starPower ?? 0) < 0.25 || hud?.starPowerActive}
          >
            Star power
          </button>
        </div>
        {countIn > 0 && (
          <div className="count-in" aria-hidden="true">
            <span className="count-in__label">Count-in</span>
            <strong>{countIn}</strong>
            <span className="count-in__hint">{activeLesson.successHint}</span>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {hud && hud.judgedNotes > 0
            ? `Accuracy ${Math.round(hud.accuracy * 100)} percent. Star power ${Math.round(
                hud.starPower * 100,
              )} percent.`
            : "Lesson ready."}
        </p>

        {paused && (
          <div
            className="pause-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Lesson paused"
            ref={pauseDialogRef}
          >
            <div className="pause-panel">
              <p className="eyebrow">Paused</p>
              <h2>{activeLesson.title}</h2>
              <p>
                {pausedSnapshot?.score.toLocaleString("en-US") ?? 0} points ·{" "}
                {Math.round((pausedSnapshot?.accuracy ?? 0) * 100)}% accuracy
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
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void beginLesson(activeLesson)}
                >
                  Restart lesson
                </button>
                <button type="button" className="btn btn-ghost" onClick={leave}>
                  Leave lesson
                </button>
              </div>
            </div>
          </div>
        )}

        {audioError && (
          <div className="audio-error" role="alert">
            <div>
              <h2>Audio couldn't start</h2>
              <p>{audioError}</p>
              <div className="pause-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void beginLesson(activeLesson)}
                >
                  Retry lesson
                </button>
                <button type="button" className="btn btn-ghost" onClick={leave}>
                  Back to lessons
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === "done" && outcome && (
          <div
            className={`lesson-outcome${outcome.passed ? " is-pass" : " is-fail"}`}
            role="dialog"
            aria-modal="true"
            aria-label="Lesson result"
          >
            <div className="lesson-outcome__panel">
              <p className="eyebrow">{outcome.passed ? "Lesson complete" : "One more rep"}</p>
              <h2>{outcome.passed ? activeLesson.title : "Not quite yet"}</h2>
              <p>
                {outcome.score.toLocaleString("en-US")} points ·{" "}
                {Math.round(outcome.accuracy * 100)}% accuracy · {outcome.starActivations} star
                activation
                {outcome.starActivations === 1 ? "" : "s"}
              </p>
              {!outcome.passed && (
                <p className="quiet-note">
                  {activeLesson.id === "star"
                    ? "Complete the whole star phrase, then activate the meter with Q before the lesson ends."
                    : activeLesson.id === "hopo"
                      ? "Hit a note with a strum first, then press the next fretted lane without strumming."
                      : "Aim for at least half the notes. Watch the receptors, not the crowd."}
                </p>
              )}
              <div className="pause-actions">
                {outcome.passed && nextLesson && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void beginLesson(nextLesson)}
                    ref={nextButtonRef}
                  >
                    Next lesson: {nextLesson.title}
                  </button>
                )}
                {outcome.passed && !nextLesson && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={leave}
                    ref={nextButtonRef}
                  >
                    Finish tutorial
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void beginLesson(activeLesson)}
                >
                  Retry
                </button>
                <button type="button" className="btn btn-ghost" onClick={leave}>
                  Back to lessons
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
