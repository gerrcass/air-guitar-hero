# Glossary

The vocabulary of Air Guitar Hero. Definitions describe the game's concepts, never the
implementation. If a term is missing here, the spec is not finished.

## Song and chart

**Song** — A playable piece of original music with a title, artist, tempo, key, duration,
and one chart per difficulty.

**Setlist** — The complete catalogue of songs available in the game.

**Chart** — The timed sequence of note groups a player performs for one song at one
difficulty. A chart is authored, not generated at run time.

**Note group** — The unit the player hits: one gem, or several gems that must be held
together as a chord.
_Avoid_: beat, note event

**Gem** — One coloured marker on one lane in a note group.
_Avoid_: note, tile

**Chord** — A note group with two or three gems that must all be held on the strum.
_Avoid_: multi-note, combo note

**Sustain** — A note group with a tail. The player keeps the required frets held to collect
ticks after the initial hit; releasing early ends the ticks but not the streak.

**Star phrase** — A marked run of note groups. Completing the whole phrase adds a quarter
of the star power meter.

**HOPO (hammer-on / pull-off)** — A note that can be hit by fretting alone, without a
strum, when it directly follows a hit note in the same phrase.

**Section** — A labelled span of a chart (intro, verse, chorus, solo, and so on) used by
Practice for looping and by the HUD for progress.

## Playfield

**Highway** — The perspective runway that carries gems toward the player.

**Receptors** — The five target pads at the hit line, one per lane.

**Lane** — One of the five fret columns: green, red, yellow, blue, orange.

**Strum** — The input that commits a note group, except for HOPOs. On keyboard it is a
dedicated key; on guitar controllers it is the strum bar.

**Whammy** — The held input that adds star power while a star sustain is active.

**Hit window** — The span around a note's scheduled time in which an input is judged.

**Judgement** — The grade of a hit: Perfect, Great, Good, or Miss.

## Performance

**Run** — One attempt at one song at one difficulty, from count-in to results.

**Streak** — Consecutive note groups hit without a miss or overstrum. Chords count once.
_Avoid_: combo counter, chain

**Multiplier** — The score factor earned by a streak: 1× for 0–9, 2× for 10–19, 3× for
20–29, and 4× from 30 onward.
_Avoid_: combo multiplier

**Rock meter** — The crowd's opinion of the performance. Hits raise it, misses and
overstrums lower it; an empty meter fails the run.

**Star power** — A meter built by completing star phrases and whammying star sustains. When
activated, it doubles the multiplier for eight bars.
_Avoid_: overdrive, power-up

**Par score** — The reference score used to award one to five stars for a run.

**Accuracy** — The weighted share of note groups hit, used on results and best-score
records.

## Modes and progression

**Career** — The progression mode. Each venue contains three songs and an encore; songs
unlock in order, and progress is tracked separately for each difficulty.
_Avoid_: campaign, story mode

**Venue** — A career chapter with its own stage identity and four-song set.

**Encore** — The final song of a venue, unlocked by clearing the three regular songs.

**Quickplay** — Immediate access to every song and difficulty, independent of career
progress.

**Practice** — A mode for a chosen section: adjustable speed, looping, and no fail.

**Tutorial** — The interactive introduction to notes, chords, sustains, star power, and
HOPOs.

**Face-off** — Local two-player mode on one chart. Each player has an independent score,
streak, and rock meter; the higher score wins if both survive.
_Avoid_: versus, battle mode

**Star rating** — The one-to-five-star result of a run, derived from its par score.

**Guitar** — A cosmetic instrument finish unlocked by earning career stars.

## System

**Calibration** — The audio/visual offset applied to input timing so a player's equipment
feels in sync.

**Note speed** — How quickly the highway scrolls. It changes approach time, never the hit
window.

**Save** — The versioned local record of career progress, best scores, unlocks, and
settings.

**No-fail** — A modifier that keeps the rock meter from ending a run. Available in
Practice and as an accessibility setting.
