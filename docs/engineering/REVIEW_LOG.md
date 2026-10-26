# Review log

Feature: Air Guitar Hero (spec #1, tickets #2–#11)
Integration branch: `feat/air-guitar-hero`
Fixed point for both rounds: `main`
Protocol: two independent reviewers per round, same shared must-check list, distinct primary lenses in
round 2. Reviewers were told not to read this file or each other's output.

## Round 1

Both reviewers inspected the full `git diff main...HEAD`, the spec and ten tickets,
`ARCHITECTURE.md`, `CODING_STANDARDS.md`, `GLOSSARY.md`, the design grill, ADRs, and the
`code-review` skill. Both returned **DO NOT MERGE**.

### Reviewer A — holistic standards + spec

Blockers:
- Global gameplay keyboard handling prevented Space/Enter on the pause dialog; no focus trap.
- “Skip to content” used `#main`, which the hash router interpreted as a route change.

Majors:
- Calibration copy and path disagreed; the test click did not use the offset.
- Gamepad menu navigation stayed active during tutorial/face-off play; native selects had no
  gamepad path; no gamepad pause.
- Easy retained 16th-note star bursts.
- `motif` was authored but unused; several charts shared one rhythmic template.
- Equipped guitar had no visible payoff.
- Missing `RELEASE.md`; unreferenced screenshots; synthetic five-star results evidence.
- Results claimed a saved best for failed quickplay runs; practice quit labels said Quickplay.
- Practice beat lines were out of phase; practice slices could award a truncated star phrase.
- Unknown song deep links threw.

### Reviewer B — holistic standards + spec

Blockers:
- A strum immediately after fretting a HOPO became an overstrum; a strum-everything player
  could not clear HOPO-heavy Expert charts. HOPOs were also drawn like normal notes.
- Gamepad-only players could not start/pause a solo run; menu navigation could eject them from
  tutorial or face-off mid-run.

Majors:
- Unknown song deep links threw a blank page.
- Career lock rules were only enforced in the UI; a direct run URL could clear a locked song.
- Skip link routed to the menu.
- `motif` unused.

Minors included the failed-run best-score label, tutorial sustain success not checking ticks,
calibration test click, practice labels, progress using the target duration, missing HOPO relief
setting, and missing/unreferenced release docs and screenshots.

### Comparison and dispatch refinement

- **Both agreed:** keyboard pause activation/focus, skip-link routing, gamepad start/pause/menu
  leaks, unknown-song routing, career-URL lock enforcement, unused motif/template similarity,
  failed-run copy, evidence/doc gaps.
- **One-only:** HOPO strum overstrum (B), Easy star burst density (A), equipped-guitar payoff (A),
  calibration auto-miss deadline (A), tutorial sustain success (B), practice beat phase (A).
- **No direct contradictions**; A treated the calibration click/pulse as broken while B called it a
  judgement call. Both fixes were applied.

### Fixes landed

Commit `a9b60e0` (plus the input work in `986efa3`/`3581c16`) resolved the blockers and majors:
- Keyboard listeners detach while paused; pause dialogs trap focus; Escape resumes. Skip link is a
  focus button, not a route.
- HOPO strum grace (120 ms), HOPO ring cue, and a regression test that strums every HOPO.
- Gamepad start on the focused gate, pad pause (button 8), menu suspension via a gameplay-active
  flag, select cycling, and hot-plug/assignment tests.
- Star phrases now keep every other note in a 16/20-note window and drop the rest: 8–10 groups at a
  strummable spacing on every difficulty. Motif data now drives lane timing.
- Calibration shifts the judged clock as well as input timestamps; the test click uses the offset
  and the pulse delays for negative offsets.
- Career run URLs are gated; locked songs cannot start or record. Invalid songs/routes fall back.
- Practice pre-roll is bar-aligned and clears pre-section star flags; HUD progress uses the chart
  duration; practice labels say Practice.
- Results screens use real engine counts for evidence; failed runs no longer claim a saved best.
- Equipped guitar appears on the run gate; HOPO relief setting added; tutorial sustain success
  requires ticks; RELEASE.md and all README screenshot references added.

Accepted residual minor: pausing releases held frets, so sustain ticks stop across a pause rather
than resuming. This is explicit and does not affect scoring integrity; it stays as a known minor.

### Round-2 dispatch refinement

Two **new** independent reviewers were given distinct primary lenses while keeping the same shared
must-check list (spec/tickets, full diff, standards, real tests, evidence):

- Reviewer C — gameplay/content/engine/input correctness. Must verify or falsify the HOPO strum,
  star-spacing, calibration-clock, motif, practice-slice, face-off and career-lock claims.
- Reviewer D — UX/accessibility/release risk. Must verify or falsify the pause-dialog, skip-link,
  gamepad menu/pause/start, evidence, README, CI, Pages and release-doc claims.

Both were told to focus first on whether round-1 findings are actually fixed, then hunt for
regressions or new gaps, and to return a merge verdict.

## Round 2

Pending.
