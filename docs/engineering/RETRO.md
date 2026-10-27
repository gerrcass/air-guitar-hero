# Engineering retro

Session: complete Air Guitar Hero implementation (spec #1, tickets #2–#11)
Integration branch: `feat/air-guitar-hero`
Date: 2026-10-26

This is the environment retrospective, not a product retrospective. Items are ranked by the
leverage they would have had on this run. Everything marked **implemented** is in this PR.

## What the run exposed

| Signal | Evidence |
| --- | --- |
| Review found real defects twice | Round 1: 4 blockers; round 2: 2 blockers plus majors |
| The fastest feedback was the engine seam | 98 unit tests run in ~0.7 s; review defects were pinned there quickly |
| Browser feedback was the slow loop | 32 Playwright tests take ~1.5 min and need a production build |
| Evidence drift was a real risk | A synthetic results path produced zero judgement counts in a committed screenshot |
| CI hardware differs from local | A 60 Hz local run became 30 fps on the shared runner |

## Improvements, highest leverage first

### 1. Give every project a unique preview port (implemented)

`vite preview --port 4173` collided with another project on this machine, causing confusing
`webServer` failures. The Playwright and screenshot ports are now 4317/4318, matching the
project’s scripts. **Why it matters:** removes a whole class of “tests cannot start” noise that
looks like a code failure.

### 2. Enforce the screenshot manifest (implemented)

`AGENTS.md` says only README-referenced screenshots belong in git, but nothing checked it. The
review found four unreferenced files. `npm run verify:screenshots` now runs inside `npm run check`
and fails on missing or unreferenced PNGs.

### 3. Make review findings into regression tests (implemented)

Every substantive review finding got a seam test where one existed: overlapping note windows,
post-HOPO strum grace, HOPO presence on Hard/Expert, star spacing, calibration test sign,
practice time stretching, face-off winner rules, modal focus, audio-resume recovery, mobile
overflow. **Why it matters:** the next agent cannot silently regress the exact things reviewers
found.

### 4. Make the performance gate portable (implemented)

An absolute 55 fps assertion turned the GitHub Actions browser job red on a 30 Hz runner, even
though local median was 59.9 fps. The test now measures an idle rAF baseline and asserts gameplay
keeps at least 75% of the available cadence in CI, while local runs keep the absolute ≥55 fps
gate. `PERFORMANCE.md` documents both. **Why it matters:** CI can gate regressions without lying
about hardware.

### 5. Generate evidence through the real engine (implemented)

The first results screenshot used a score-only test override and showed 94% accuracy with zero
judgement counts. The test bridge now has `completeRun`, which drives the real `GameSession`
through every note, sustains, and star activation before navigating to results. **Why it matters:**
evidence is now a product of the code under test, not a plausible-looking mock.

### 6. Keep docs out of the formatter’s blast radius (implemented)

Biome originally rewrote unrelated Markdown docs during `npm run format`. `biome.json` now excludes
docs/screenshots and Markdown; documentation edits stay intentional.

### 7. Add release/review/performance pointers to AGENTS.md (implemented)

The run had to rediscover where the review log and release checklist belonged. `AGENTS.md` now
points at `REVIEW_LOG.md`, `PERFORMANCE.md`, and `RELEASE.md`, and names the screenshot check.
**Why it matters:** the next agent spends attention on work, not on finding the rules.

## Cheap follow-ups not required for this release

- **Test bridge schema:** a typed shared interface would make the Playwright hooks easier to evolve
  than page-global function names.
- **Evidence bundle command:** one command could run check, e2e, screenshots, and assemble the PR
  comment body. The pieces exist but are separate.
- **Screenshot sizes:** the full-page results capture is 1440×1318; a second viewport crop might be
  kinder to README readers.
- **Portable performance matrix:** record CPU model and Chromium refresh cadence beside each local
  sample so future comparisons are apples-to-apples.

## Residual risks

- Two accepted minors remain (pause ends sustain ticks; a practice pre-roll can inherit a note at
  the hit line). They are documented in `REVIEW_LOG.md` and do not affect saved progress.
- Screenshot content can go stale when visual work lands after capture; the manifest prevents
  orphan files, not stale pixels. Recapture as part of release.
- Gamepad audio unlock depends on the browser treating the focused-button activation as a user
  gesture; the Playwright fake-pad path passes, but a real gamepad-first boot should be checked on
  the target browser.
