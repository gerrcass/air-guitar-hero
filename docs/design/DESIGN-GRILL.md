# Design grill — Air Guitar Hero

**Status:** decisions accepted (the user delegated answers to the recommended option)
**Method:** `/grill-with-docs` design tree, worked in rounds. Every frontier question is
recorded with the recommendation that was accepted, so the reasoning survives the session.

## Objective

Build the most complete guitar-hero game that can ship as a static web app: the 2005
console feature set, an original soundtrack, and a finish that feels like a game rather
than a tech demo. "Feature parity" here means every core verb from Guitar Hero (2005) is
present and polished: five-fret play, chords, sustains, hammer-ons/pull-offs, star power,
whammy, rock meter, multiplier, career, quickplay, practice, tutorial, local face-off,
unlockables, calibration, and four difficulties. Licensed music is explicitly replaced
with an original, synthesized setlist.

## Round 1 — Product shape

### Q1. Platform and stack: what actually ships?

A static single-page app with no server or account system: React + TypeScript + Vite,
Canvas 2D for the playfield, Web Audio for sound, localStorage for saves, GitHub Pages for
hosting. This keeps the whole game installable as a folder of static files and removes
every network failure mode from gameplay.

**Accepted:** static client-only SPA on GitHub Pages.

### Q2. Music: how do we get a soundtrack without licensing 30 songs?

Write twelve original instrumental tracks in a compact, code-native composition format and
render them with a Web Audio synth (distorted leads, power-chord rhythm, bass, drums,
pads). The same composition data generates the charts, so audio and notes are aligned by
construction rather than by manual authoring. No audio downloads, no licensing, no CORS,
and the whole game can still be a few hundred kilobytes.

**Accepted:** original synthesized soundtrack generated from shared song data.

### Q3. Which feature set defines parity?

Keep the core loop identical, adapt the content shell:

- Five lanes, four difficulties (Easy 3 lanes, Medium 4, Hard/Expert 5), chords, sustains,
  HOPOs, overstrum penalties, 1×–4× multiplier, star phrases, star power, whammy,
  rock meter, fail and retry.
- Career with venues and encores, quickplay, practice with speed and loops, interactive
  tutorial, local two-player face-off, local high scores, unlockable guitars, settings,
  pause/results/retry.
- Twelve original songs, three venues, four songs per venue (three plus an encore).

Online play, song licensing, character animation, a chart editor, microtransactions, and
a shop economy are out. Guitar cosmetics unlock from career stars instead of currency.

**Accepted:** the adapted 2005 feature set above, with "no server, no licensed content".

### Q4. Two-player: what does "multiplayer" mean in a browser?

Local split-screen Pro Face-Off. Both players play the same chart simultaneously on one
keyboard, or with gamepads. Scores, streaks, and rock meters are independent. First to
fail loses; if both survive, the higher score wins. No online matchmaking.

**Accepted:** local split-screen only.

### Q5. Progression: what is persisted?

Career progress is per difficulty, with songs unlocked in sequence per venue. Quickplay
always exposes the whole setlist so a new player can experience any track. Star ratings
are saved per song and difficulty. Star totals unlock guitar finishes. Settings and
calibration persist. No accounts; saves are versioned localStorage with a reset action.

**Accepted:** local, per-difficulty career progress plus global quickplay access.

## Round 2 — Gameplay model

### Q6. What is the timing authority?

The audio clock, not `setInterval` or frame count. A pure `GameSession` receives input
events timestamped against the same clock and owns judgement, scoring, and state. The
renderer interpolates from a snapshot; the UI renders React state at a lower frequency.
A deterministic manual clock makes the whole engine unit-testable without a browser.

**Accepted:** audio-clock-driven, pure state machine with an injectable clock.

### Q7. How forgiving is the timing?

Four judgements: Perfect (±45 ms), Great (±90 ms), Good (±135 ms), Miss (outside the
window or passed). Difficulties widen/narrow the outer window slightly, but the note
speed does not change judgement. Notes are judged in lane order; the earliest eligible
note is consumed. A strum with no eligible note is an overstrum and breaks the streak.
This is tight enough to reward skill and generous enough to be playable on a laptop
keyboard.

**Accepted:** fixed judgement ladder with difficulty-tuned outer windows.

### Q8. How do chords, sustains, and HOPOs work?

A chord note group requires all of its lanes to be held at the strum. Missing any lane
misses the chord. Sustains tick score while the required frets remain held; a star-phrase
sustain also builds star power while the whammy input is held. A release after the tail
starts keeps the combo but ends the ticks. HOPOs are notes flagged from chart spacing and
can be hit by fretting alone when the previous note in the phrase was hit; they are
available on Hard/Expert and disabled by a setting for accessibility.

**Accepted:** chord groups, held sustains, spacing-derived HOPOs, optional HOPO relief.

### Q9. Star power economics?

Star phrases are authored segments of 8–16 notes; completing one adds 25% to the meter.
Activation consumes the filled meter and doubles the multiplier for 32 beats (8 bars).
Whammying star sustains adds meter. Star power never revives a failed player. Activation
is a deliberate input (Enter/P), not automatic.

**Accepted:** four phrases fill the meter; 8 bars of 2× scoring.

### Q10. Scoring and stars?

Base 50 points per note, multiplied by the current 1×–4× multiplier and the 2× star
power factor. Chords count as one combo increment but score each gem. Sustains add ticks.
Stars are awarded on a score curve per song/difficulty: 1 star for passing, then 2–5 at
35%, 55%, 75%, and 90% of a calculated par score. Fail and retry are always available.
Practice and tutorial never fail.

**Accepted:** 50-point gems, combo multiplier, five-star score thresholds.

### Q11. What happens when the rock meter empties?

The run fails, the song stops, and the results screen offers Retry, Practice, or Quit. In
Career, a failed song does not unlock the next song. In Face-Off, a failed player is out;
the other continues. A "No Fail" switch exists in Practice and in Settings for players who
want to learn a song.

**Accepted:** fail is reversible and never destructive.

## Round 3 — Experience and delivery

### Q12. Art direction?

Late-night arena: near-black stage, hot magenta/cyan/amber lighting, chrome and worn
paint, condensed display type (Bebas Neue) with a grotesk body (Space Grotesk). The
highway is a pseudo-3D Canvas runway with a visible crowd, moving light rig, and
particles. Menus use large album-art cards with procedural cover art. Every song gets a
distinct palette, but the shell stays consistent.

**Accepted:** "late-night arena" visual system.

### Q13. Input and accessibility?

Keyboard and gamepad are first-class. Default keys: P1 A/S/D/F/G, Space to strum, Q for
star power, W for whammy; P2 H/J/K/L/;, Right Shift to strum, P for star power, O for
whammy. Gamepads map face buttons to frets, bumpers to strum, and shoulder/start for star
power. Menus are keyboard navigable with visible focus and ARIA labels. Settings include
lefty flip, colorblind gem palette, reduced motion, static highway, note speed,
calibration, and separate music/SFX/crowd volume. Touch gameplay and full key rebinding
are out of scope; mobile gets a "keyboard or gamepad recommended" notice and usable menus.

**Accepted:** keyboard + gamepad, accessibility settings, no touch gameplay.

### Q14. Quality gates and delivery?

TypeScript strict, Biome lint/format, Vitest unit tests for engine/content/persistence,
Playwright smoke and journey tests, axe accessibility checks on menus, production build,
and a GitHub Actions pipeline that deploys `main` to GitHub Pages. Gameplay screenshots
are generated from the real build and committed for the README. Performance budget:
60 fps at 1440×900, device pixel ratio capped at 2, no heavy 3D/audio dependencies.

**Accepted:** strict checks, browser tests, CI deploy to Pages.

### Q15. What is explicitly not in this release?

Licensed songs, online multiplayer, chart editor, mobile touch play, character animation,
shop economy, achievements beyond stars/unlocks, localization, and a backend. These are
recorded as out of scope so the team does not quietly expand the project.

**Accepted:** the non-goals above.

## Frontier status

No unresolved decisions remain. The spec and tickets are derived from this log.
