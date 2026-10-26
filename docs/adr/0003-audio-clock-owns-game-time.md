# Audio clock owns game time

Gameplay time comes from the Web Audio `AudioContext` clock, adjusted by the player's
calibration offset. The pure game session judges input against that clock; React renders
snapshots, and Canvas interpolates the highway. `requestAnimationFrame` never determines
whether a note was hit. Audio is the only clock that stays locked to the music, and an
injectable clock keeps the engine deterministic under Vitest. The cost is that the game
cannot advance until the audio context has been unlocked by a user gesture, so every
play flow needs a start gate.
