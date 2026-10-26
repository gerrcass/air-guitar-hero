# Air Guitar Hero

A browser-native guitar-hero game: five lanes, original synthesized setlist, career,
quickplay, practice, tutorial, and local face-off. Static React + TypeScript app deployed
to GitHub Pages.

## Read before working

- `docs/engineering/ARCHITECTURE.md` — module boundaries, core contracts, seams.
- `GLOSSARY.md` — the game's canonical vocabulary. Use it in code, tests, and commits.
- `docs/adr/` — decisions that are expensive to reverse.
- `docs/design/DESIGN-GRILL.md` — settled scope and non-goals.

## Commands

```sh
npm ci                # install
npm run dev           # local dev server
npm run check         # typecheck + lint + unit tests + content validation
npm run test:e2e      # Playwright journeys (starts its own server)
npm run build         # production build
npm run screenshots   # capture README screenshots from the production build
```

A change is done when `npm run check` passes, the affected journey is covered by a browser
test, and the ticket's acceptance criteria are demonstrated.

## Invariants

- **The engine is pure.** `src/game` takes time and inputs as arguments; it never reads the
  DOM, storage, `Date.now()`, or `AudioContext` directly. Tests drive it with a fake clock.
- **The audio clock is time.** Chart times, input timestamps, and calibration are seconds
  from song start. Rendering and React never decide a judgement.
- **Charts are deterministic.** The same song and difficulty produce the same bytes on
  every load. No `Math.random()` in content generation.
- **React never renders a gem.** The highway is Canvas; React owns menus, HUD, and overlays.
- **Saves are versioned and defensive.** Corrupt or older localStorage must load or reset,
  never crash the app.
- **The game is keyboard- and gamepad-complete.** Every action is reachable without a mouse.
- **Artifacts stay out of git.** `dist/`, `node_modules/`, `playwright-report/`,
  `test-results/`, and local captures are ignored. The only committed screenshots are the
  ones referenced by `README.md`.

## Working with tickets

GitHub issues are the source of truth (`docs/agents/issue-tracker.md`). Read the ticket,
its blockers, the spec, and the architecture notes before editing. Keep the change inside
the ticket's vertical slice; if the slice reveals a missing prefactor, land the prefactor
first. Close the ticket only after its acceptance criteria and evidence are on the
integration branch.

## Evidence

Visual changes need a real-browser screenshot from the production build. PR bodies follow
`/pr` (Summary, Evidence, Merge Danger); attach the evidence with `gh pr comment --attach`
so it survives outside the repo. Gameplay claims are backed by the Playwright journey that
exercises them.
