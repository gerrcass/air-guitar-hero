import { useEffect, useState } from "react";
import { AudioEngineError, audioEngine } from "../audio/engine";
import { difficultyLabel } from "../components/DifficultyPicker";
import { calibrationTestDelays, noteSpeedLabel } from "../state/settings";
import { saveStore, useSave } from "../state/store";

function useGamepadCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = (): void => {
      try {
        const pads =
          typeof navigator.getGamepads === "function"
            ? Array.from(navigator.getGamepads()).filter((pad) => pad !== null)
            : [];
        setCount(pads.length);
      } catch {
        setCount(0);
      }
    };
    update();
    const timer = setInterval(update, 1500);
    window.addEventListener("gamepadconnected", update);
    window.addEventListener("gamepaddisconnected", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("gamepadconnected", update);
      window.removeEventListener("gamepaddisconnected", update);
    };
  }, []);
  return count;
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly description: string;
  readonly checked: boolean;
  readonly onChange: (value: boolean) => void;
}): React.JSX.Element {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
    </label>
  );
}

export function SettingsScreen(): React.JSX.Element {
  const save = useSave();
  const settings = save.settings;
  const gamepads = useGamepadCount();
  const [pulse, setPulse] = useState(false);
  const [audioMessage, setAudioMessage] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    audioEngine.setVolumes(settings);
  }, [settings]);

  const testCalibration = async (): Promise<void> => {
    setAudioMessage("");
    try {
      await audioEngine.unlock();
      const delays = calibrationTestDelays(settings.calibrationMs);
      audioEngine.playCalibrationClick(settings.calibrationMs);
      window.setTimeout(() => setPulse(true), delays.pulseMs);
      window.setTimeout(() => setPulse(false), delays.pulseMs + 240);
      setAudioMessage(
        "Click and pulse played. Adjust the offset until the delay between them disappears.",
      );
    } catch (error) {
      setAudioMessage(
        error instanceof AudioEngineError
          ? error.message
          : "Audio could not start. Check permissions and try again.",
      );
    }
  };

  const set = (patch: Parameters<typeof saveStore.setSettings>[0]): void => {
    saveStore.setSettings(patch);
  };

  return (
    <div className="screen settings-screen">
      <header className="screen-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Make the rig fit your hands</h1>
          <p>
            Every setting saves the moment you change it. Calibration and the three volume buses are
            applied live; nothing here changes chart timing.
          </p>
        </div>
        <div className="screen-heading__badge">
          <span>Saved immediately</span>
          <span>
            {gamepads} gamepad{gamepads === 1 ? "" : "s"} connected
          </span>
        </div>
      </header>

      <div className="settings-grid">
        <section className="settings-section panel" aria-labelledby="visual-settings">
          <h2 id="visual-settings">Highway &amp; motion</h2>
          <label className="field field--range">
            <span className="field__label">
              Note speed <strong>{noteSpeedLabel(settings.noteSpeed)}</strong>
            </span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={settings.noteSpeed}
              onChange={(event) => set({ noteSpeed: Number(event.target.value) })}
              aria-valuetext={`Note speed ${settings.noteSpeed}, ${noteSpeedLabel(settings.noteSpeed)}`}
            />
            <span className="field__hint">
              Changes how far ahead gems appear. It never changes the hit window.
            </span>
          </label>
          <Toggle
            label="Lefty flip"
            description="Reverse the five lanes for left-handed players."
            checked={settings.leftyFlip}
            onChange={(value) => set({ leftyFlip: value })}
          />
          <Toggle
            label="Colourblind palette"
            description="High-contrast lane colours; pair with lane symbols for full redundancy."
            checked={settings.colorblindPalette}
            onChange={(value) => set({ colorblindPalette: value })}
          />
          <Toggle
            label="Lane symbols"
            description="Draw a shape on every gem and receptor, so colour is never the only signal."
            checked={settings.laneSymbols}
            onChange={(value) => set({ laneSymbols: value })}
          />
          <Toggle
            label="Reduce motion"
            description="Suppress particles, camera shake, crowd bobbing, and animated stage beams."
            checked={settings.reduceMotion}
            onChange={(value) => set({ reduceMotion: value })}
          />
          <Toggle
            label="Static highway"
            description="Freeze background motion in the arena while gems still scroll toward the line."
            checked={settings.staticHighway}
            onChange={(value) => set({ staticHighway: value })}
          />
          <Toggle
            label="Camera shake"
            description="Hit, miss, and star-power impulses move the camera slightly."
            checked={settings.cameraShake}
            onChange={(value) => set({ cameraShake: value })}
          />
        </section>

        <section className="settings-section panel" aria-labelledby="audio-settings">
          <h2 id="audio-settings">Audio</h2>
          <label className="field field--range">
            <span className="field__label">
              Music <strong>{Math.round(settings.musicVolume * 100)}%</strong>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.musicVolume}
              onChange={(event) => set({ musicVolume: Number(event.target.value) })}
            />
          </label>
          <label className="field field--range">
            <span className="field__label">
              SFX <strong>{Math.round(settings.sfxVolume * 100)}%</strong>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.sfxVolume}
              onChange={(event) => set({ sfxVolume: Number(event.target.value) })}
            />
          </label>
          <label className="field field--range">
            <span className="field__label">
              Crowd <strong>{Math.round(settings.crowdVolume * 100)}%</strong>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.crowdVolume}
              onChange={(event) => set({ crowdVolume: Number(event.target.value) })}
            />
          </label>
          <p className="field__hint">
            Volumes ride separate buses into a master limiter. Music is the band; SFX is judgement
            feedback; crowd is the room.
          </p>
        </section>

        <section className="settings-section panel" aria-labelledby="calibration-settings">
          <h2 id="calibration-settings">Calibration</h2>
          <p className="quiet-note">
            Use headphones or your usual speakers. If your hits feel late, move the offset positive;
            if they feel early, move it negative. Positive values delay the test click against the
            pulse. Chart times never move.
          </p>
          <label className="field field--range">
            <span className="field__label">
              Offset{" "}
              <strong>
                {settings.calibrationMs > 0 ? "+" : ""}
                {settings.calibrationMs} ms
              </strong>
            </span>
            <input
              type="range"
              min={-200}
              max={200}
              step={5}
              value={settings.calibrationMs}
              onChange={(event) => set({ calibrationMs: Number(event.target.value) })}
              aria-valuetext={`${settings.calibrationMs} milliseconds`}
            />
          </label>
          <div className="calibration-test">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void testCalibration()}
            >
              Play test click
            </button>
            <span className={`calibration-pulse${pulse ? " is-pulsing" : ""}`} aria-hidden="true" />
            <span className="quiet-note" aria-live="polite">
              {audioMessage || "Click, then pulse. Adjust until they land together."}
            </span>
          </div>
        </section>

        <section className="settings-section panel" aria-labelledby="game-settings">
          <h2 id="game-settings">Game rules</h2>
          <Toggle
            label="No fail"
            description="The rock meter can empty without ending a run. Available in every mode for learning."
            checked={settings.noFail}
            onChange={(value) => set({ noFail: value })}
          />
          <Toggle
            label="HOPO fretting"
            description="Flagged notes can be hit by fretting alone after a hit. Turn off to require a strum for every note."
            checked={settings.hopoRelief}
            onChange={(value) => set({ hopoRelief: value })}
          />
          <p className="field__hint">
            Practice and Tutorial always use no-fail. Career and Quickplay still record real
            accuracy and star ratings.
          </p>
          <p className="quiet-note">
            Current default run difficulty: {difficultyLabel(save.lastDifficulty)}. Change it in
            Quickplay, Career, Practice, or Face-off.
          </p>
        </section>

        <section className="settings-section panel panel--danger" aria-labelledby="reset-save">
          <h2 id="reset-save">This device's save</h2>
          <p>
            Career stars, best scores, the tutorial marker, unlocks, and settings live in one
            versioned local document. Resetting cannot be undone.
          </p>
          {!confirmReset ? (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmReset(true)}>
              Reset save…
            </button>
          ) : (
            <fieldset className="confirm-row">
              <legend className="sr-only">Confirm reset</legend>
              <p>Reset every saved star, best score, and setting?</p>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  saveStore.reset();
                  setConfirmReset(false);
                  setAudioMessage("Save reset. A fresh career starts at The Rusty Anchor.");
                }}
              >
                Yes, reset everything
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmReset(false)}
              >
                Cancel
              </button>
            </fieldset>
          )}
        </section>
      </div>

      <p className="settings-footnote">
        Gamepad support: standard mapping, hot-plug supported. Face buttons play lanes; LB / LT / RT
        strum; Start activates star power; left-stick click is whammy. Menus move with the D-pad and
        select with A. <a href="#/extras">Full controls →</a>
      </p>
    </div>
  );
}
