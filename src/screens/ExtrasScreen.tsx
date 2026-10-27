import { GUITAR_FINISHES } from "../state/cosmetics";
import { useSave } from "../state/store";

const KEYBOARD_ROWS = [
  { action: "Frets (green → orange)", p1: "A S D F G", p2: "H J K L ;" },
  { action: "Strum", p1: "Space", p2: "Right Shift or Enter" },
  { action: "Star power", p1: "Q (or Enter in solo)", p2: "P" },
  { action: "Whammy", p1: "W", p2: "O" },
  { action: "Pause", p1: "Escape", p2: "Escape" },
];

const GAMEPAD_ROWS = [
  { action: "Frets", mapping: "A / B / X / Y / RB (buttons 0–3, 5)" },
  { action: "Strum", mapping: "LB / LT / RT (buttons 4, 6, 7)" },
  { action: "Star power", mapping: "Start (button 9)" },
  { action: "Whammy", mapping: "Left-stick click (button 10)" },
  {
    action: "Menus",
    mapping: "D-pad or left stick to move, A to select, range fields adjust left/right",
  },
];

export function ExtrasScreen(): React.JSX.Element {
  const save = useSave();
  return (
    <div className="screen extras-screen">
      <header className="screen-heading">
        <div>
          <p className="eyebrow">Controls &amp; credits</p>
          <h1>Everything the rig can do</h1>
          <p>
            Air Guitar Hero is a static browser game: React shell, Canvas playfield, Web Audio
            synth, and a local versioned save. No account, server, telemetry, or third-party
            tracker.
          </p>
        </div>
        <div className="screen-heading__badge">
          <span>v{__APP_VERSION__}</span>
          <span>build {__BUILD_SHA__}</span>
          <span>Save v1</span>
        </div>
      </header>

      <div className="extras-grid">
        <section className="panel" aria-labelledby="keyboard-title">
          <h2 id="keyboard-title">Keyboard</h2>
          <table className="control-table">
            <thead>
              <tr>
                <th scope="col">Action</th>
                <th scope="col">Player 1</th>
                <th scope="col">Player 2</th>
              </tr>
            </thead>
            <tbody>
              {KEYBOARD_ROWS.map((row) => (
                <tr key={row.action}>
                  <th scope="row">{row.action}</th>
                  <td>
                    <kbd>{row.p1}</kbd>
                  </td>
                  <td>
                    <kbd>{row.p2}</kbd>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="quiet-note">
            Enter is an alternative Player 2 strum in Face-off, and Player 1 star power in solo
            modes. HOPOs can be played by fretting alone after a hit note, on Hard and Expert.
          </p>
        </section>

        <section className="panel" aria-labelledby="gamepad-title">
          <h2 id="gamepad-title">Gamepad</h2>
          <table className="control-table">
            <thead>
              <tr>
                <th scope="col">Action</th>
                <th scope="col">Standard mapping</th>
              </tr>
            </thead>
            <tbody>
              {GAMEPAD_ROWS.map((row) => (
                <tr key={row.action}>
                  <th scope="row">{row.action}</th>
                  <td>{row.mapping}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="quiet-note">
            The first connected pad drives Player 1; a second pad drives Player 2 in Face-off.
            Hot-plugging is supported. Press a face button once after connecting so the browser
            exposes the device.
          </p>
        </section>

        <section className="panel" aria-labelledby="difficulty-title">
          <h2 id="difficulty-title">Difficulties</h2>
          <dl className="extras-list">
            <div>
              <dt>Easy</dt>
              <dd>3 lanes, single notes only. Learn the arrangement.</dd>
            </div>
            <div>
              <dt>Medium</dt>
              <dd>4 lanes, dyads and a denser lead line.</dd>
            </div>
            <div>
              <dt>Hard</dt>
              <dd>5 lanes, full chords, sustains, and HOPO runs.</dd>
            </div>
            <div>
              <dt>Expert</dt>
              <dd>Every master note, full chord vocabulary, fastest runs.</dd>
            </div>
          </dl>
          <p className="quiet-note">
            Judgement windows: Perfect ±45 ms, Great ±90 ms, Good widens from ±160 ms on Easy to
            ±135 ms on Expert. Note speed changes approach time only.
          </p>
        </section>

        <section className="panel" aria-labelledby="accessibility-title">
          <h2 id="accessibility-title">Accessibility</h2>
          <ul className="extras-list extras-list--bullets">
            <li>Every menu and dialog is keyboard operable with a visible focus ring.</li>
            <li>Colourblind palette and lane symbols make colour non-essential.</li>
            <li>Reduce motion, static highway, and camera-shake toggles suppress stage effects.</li>
            <li>HUD status is mirrored into a polite live region during play.</li>
            <li>Gameplay requires a keyboard or gamepad; mobile menus remain usable.</li>
          </ul>
        </section>

        <section className="panel" aria-labelledby="credits-title">
          <h2 id="credits-title">Credits &amp; asset policy</h2>
          <p>
            Every song, arrangement, album cover, stage, icon, and chart in this project is original
            and generated by the project itself. The soundtrack is synthesized at runtime from
            deterministic song data; no recorded audio is bundled. There is no licensed music, no
            Guitar Hero catalogue, and no third-party art.
          </p>
          <p>
            Typefaces are self-hosted through Fontsource: <strong>Bebas Neue</strong> (SIL Open Font
            License) and <strong>Space Grotesk</strong> (SIL Open Font License). The game code is
            MIT licensed.
          </p>
          <p className="quiet-note">
            "Air Guitar Hero" is the project name in this repository; it is a love letter to the
            five-fret genre, not a reproduction of any commercial game's protected expression.
          </p>
        </section>

        <section className="panel" aria-labelledby="save-title">
          <h2 id="save-title">Your save</h2>
          <dl className="extras-list">
            <div>
              <dt>Career stars</dt>
              <dd>
                {Object.values(save.career).reduce(
                  (sum, career) => sum + Object.values(career.cleared).reduce((a, b) => a + b, 0),
                  0,
                )}
              </dd>
            </div>
            <div>
              <dt>Runs</dt>
              <dd>{save.stats.runs}</dd>
            </div>
            <div>
              <dt>Notes hit</dt>
              <dd>{save.stats.notesHit}</dd>
            </div>
            <div>
              <dt>Tutorial</dt>
              <dd>{save.tutorialComplete ? "Complete" : "Not complete"}</dd>
            </div>
            <div>
              <dt>Guitars earned</dt>
              <dd>
                {save.unlockedGuitars.length} / {GUITAR_FINISHES.length}
              </dd>
            </div>
          </dl>
          <p className="quiet-note">
            Saves live under <code>air-guitar-hero.save.v1</code> in this browser's localStorage.
            Corrupt or older documents fall back to a fresh save instead of crashing.
          </p>
        </section>
      </div>

      <section className="panel docs-panel" aria-labelledby="docs-title">
        <h2 id="docs-title">Project docs</h2>
        <div className="docs-links">
          <a href="https://github.com/gerrcass/air-guitar-hero#readme">README</a>
          <a href="https://github.com/gerrcass/air-guitar-hero/blob/main/docs/engineering/ARCHITECTURE.md">
            Architecture
          </a>
          <a href="https://github.com/gerrcass/air-guitar-hero/blob/main/docs/design/DESIGN-GRILL.md">
            Design decisions
          </a>
          <a href="https://github.com/gerrcass/air-guitar-hero/blob/main/GLOSSARY.md">Glossary</a>
          <a href="https://github.com/gerrcass/air-guitar-hero/blob/main/docs/engineering/REVIEW_LOG.md">
            Review log
          </a>
        </div>
      </section>
    </div>
  );
}
