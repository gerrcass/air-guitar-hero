# Coding standards

Read by reviewers. Implementation agents use this only when a rule is surprising; the
architecture doc and `AGENTS.md` carry the main constraints.

## TypeScript

- `strict` is on, `noUncheckedIndexedAccess` is on. Handle the empty case; do not paper
  over it with `!`.
- No `any`, no double casts (`as unknown as`). Model variants with discriminated unions.
- Exported functions have explicit return types when the inference is non-obvious.
- Prefer `readonly` arrays and `Readonly<...>` for values that cross the engine boundary.
- Domain values use named types: `Lane`, `Difficulty`, `Judgement`, `NoteGroup`. Do not
  pass bare `number` where a lane or difficulty is meant.
- Time in the engine is seconds from song start. Do not mix milliseconds and seconds.

## React

- Function components, one default export per screen; components stay presentational.
- Effects synchronize with external systems only (audio, canvas, listeners, storage).
  Derived values belong in render or `useMemo`.
- Never create an `AudioContext` during render or on module import; unlock on a user
  gesture.
- Interactive elements are native `button`/`a`/`input` with an accessible name. Use
  `aria-label` only when visible text is impossible.
- Keep the gameplay state out of React state. HUD snapshots are throttled to 8–12 Hz.
- CSS uses the tokens in `src/styles/tokens.css`; no raw hex outside palettes and album
  art.

## Game engine

- Pure, deterministic, and injectable-clock. No ambient time, no randomness, no I/O.
- Mutating methods are named as commands (`strum`, `pressFret`, `activateStarPower`).
  Snapshots returned to callers are immutable.
- Every judgement writes a `JudgementEvent`; scoring is a pure function of the event and
  the prior score state. Do not duplicate score math in the UI.
- A note group is consumed once. Overstrums break the streak. Misses drain the rock meter.
- Star power activation is explicit; it never revives a failed player.
- Keep constants (hit windows, drains, par curves) in one module with tests that pin them.

## Content

- Song definitions are deterministic data. Composition must not depend on wall-clock time.
- Every song has exactly four charts. Easy uses three lanes, Medium four, Hard/Expert five.
- Chart invariants: strictly increasing group times, no duplicate lane within a group, no
  note past duration, no HOPO flags on chords, every star phrase is contiguous and inside
  a section, par score > 0.
- Do not edit generated artefacts by hand. Regenerate them.

## Audio

- All nodes are disconnected and sources stopped when a run ends or restarts.
- Use a look-ahead scheduler (≥ 100 ms horizon) rather than scheduling per frame.
- Pause suspends the context and shifts the song origin on resume; it never lets the
  chart and audio drift.
- Volumes are buses (music, SFX, crowd) with a master limiter.
- No external audio files. No autoplay before a gesture.

## Tests

- Test external behaviour through a seam: engine commands → snapshot/judgements; composer →
  chart invariants; save functions → data.
- Use the fake clock. No `setTimeout` sleeps in unit tests.
- Browser tests assert user-visible outcomes, not CSS class names.
- A bug fix needs a failing test that now passes, or a note explaining why it cannot be
  expressed at a seam.

## Accessibility and performance

- Menus are operable by keyboard alone, with a visible focus ring and landmark structure.
- Honour `prefers-reduced-motion` and the in-game reduced-motion setting.
- Gems are never the only carrier of information: the HUD states the mode and the
  colourblind palette is selectable.
- Cap DPR at 2, reuse render pools, and cancel rAF when leaving gameplay or hiding the tab.
- No added dependency that ships more than ~50 kB gzipped without an ADR.
