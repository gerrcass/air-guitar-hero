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

Two new independent reviewers, C (gameplay/content/engine/input) and D (UX/accessibility/release),
received distinct primary lenses plus the same shared must-check list and a explicit
verify-or-falsify list from round 1. Both returned **DO NOT MERGE**.

### Reviewer C — gameplay, engine, content, input

Round-1 verification: HOPO strum/visual cue FIXED; Easy star spacing FIXED; motif FIXED; practice
edge handling FIXED; career lock FIXED; face-off unit coverage FIXED; HOPO relief FIXED. Calibration
remained wrong at review time (test click trained the inverse sign) and pause-sustain release
remained a known minor.

New blockers/majors:
- `earliestCandidate` chose the nearest note rather than the earliest eligible note, so overlapping
  windows could score the later gem and miss the earlier one.
- Calibration test click direction was inverted relative to the judgement clock.
- Practice-speed scheduling stretched note start times but not note durations.
- The HOPO tutorial could never pass with HOPO relief disabled.
- The flat 2.6× par made five stars too cheap; par did not follow the real multiplier curve.
- Midnight Fossil had no HOPOs on Hard or Expert.
- Minor: focus-trap refs were not attached on face-off/tutorial result dialogs; snapshots exposed a
  mutable note-state array; multiple sustain ticks in one update displayed as one.

### Reviewer D — UX, accessibility, release risk

Round-1 verification: gamepad paths FIXED; equipped guitar FIXED; evidence/docs FIXED; failed-run
copy/progress/tutorial sustain FIXED; unknown routes FIXED. Keyboard pause activation and skip link
were FIXED, but dialog focus traps were still broken because refs were never attached. The CI
performance job was red: the runner measured 30 fps, so the absolute 55 fps assertion could never
pass on that hardware.

New majors/minors:
- Face-off/tutorial dialogs were not actually trapped; audio-resume failure left focus inside the
  pause dialog while the recovery panel was outside.
- Live regions were driven by the 90 ms HUD state and could announce ~11 times per second.
- Ending a deliberate run rendered the failure headline and “Failed run” copy.
- Mobile play gate lost the keyboard/gamepad notice; Extras overflowed by 13 px at 390 px.
- Practice did not remember its last song/difficulty.
- The results screenshot clipped its lower rows and actions.
- Tutorial HOPO gating and the CI performance strategy needed fixes.

### Round-2 comparison and fixes

Agreement: both flagged the tutorial HOPO gate, the CI/performance gate, and the modal focus-trap
refs. C uniquely found the nearest-note judgement bug, practice audio duration, star curve and
Midnight HOPO gap. D uniquely found live-region flooding, audio-recovery focus, abandoned-run copy,
mobile overflow/notice, practice persistence, and screenshot clipping. There were no contradictory
claims; the calibration disagreement was resolved by defining the test-sign convention and pinning
it with `calibrationTestDelays`.

Fixes landed after round 2:
- Earliest-eligible note selection with an overlapping-window regression test.
- HOPO strum grace + ring cue; HOPO presence in all Hard/Expert charts; HOPO tutorial enabled
  independently of the relief setting.
- Calibration now shifts the judged clock and input together; test click/pulse delays are pinned
  and model the sign of the judgement correction.
- Audio durations stretch with practice speed; a unit test pins the time factor.
- Par walks the real 1×–4× multiplier curve and sustain ticks.
- Snapshots are immutable; per-update sustain tick state is accurate.
- Pause/result/outcome/audio-error focus traps attached; audio recovery clears the pause state and
  captures focus.
- Live regions throttled to roughly 2.7 s summaries.
- Deliberate quits are labelled “Run ended early” with no best/career write.
- Mobile gate notice added; Extras narrowed; practice remembers song/difficulty; results evidence
  is full-page.
- Performance CI measures an idle baseline and asserts gameplay retains at least 75% of the
  available cadence; local runs still enforce absolute ≥55 fps. The CI browser job is green.

Accepted residual minors: pausing releases held frets, so a sustain tail stops across a pause
(earned score/streak remain); a practice pre-roll can place an inherited note at the hit line as
the count-in ends. Both are visible only at deliberately awkward edges and do not change saved
progress.

### Final verdict

After the fixes, `npm run check` (98 unit tests + content + screenshot manifest), the 32-test
Playwright suite, axe scans, and the CI browser job pass. The remaining findings are accepted
minors, not merge blockers. **MERGE.**
