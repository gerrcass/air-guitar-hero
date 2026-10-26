import type { JSX } from "react";
import { DIFFICULTIES, type Difficulty } from "../game/types";

const LABELS: Readonly<Record<Difficulty, { label: string; lanes: string; blurb: string }>> = {
  easy: { label: "Easy", lanes: "3 lanes", blurb: "No chords. Learn the song." },
  medium: { label: "Medium", lanes: "4 lanes", blurb: "Chords and faster runs." },
  hard: { label: "Hard", lanes: "5 lanes", blurb: "HOPOs, sustains, full chords." },
  expert: { label: "Expert", lanes: "5 lanes", blurb: "The full chart, no shortcuts." },
};

export function DifficultyPicker({
  value,
  onChange,
  compact = false,
  disabled = false,
}: {
  readonly value: Difficulty;
  readonly onChange: (difficulty: Difficulty) => void;
  readonly compact?: boolean;
  readonly disabled?: boolean;
}): JSX.Element {
  return (
    <fieldset className={`difficulty-picker${compact ? " difficulty-picker--compact" : ""}`}>
      <legend>Difficulty</legend>
      <div className="difficulty-picker__options">
        {DIFFICULTIES.map((difficulty) => (
          <button
            key={difficulty}
            type="button"
            className="difficulty-picker__option"
            aria-pressed={value === difficulty}
            onClick={() => onChange(difficulty)}
            disabled={disabled}
          >
            <span className="difficulty-picker__label">{LABELS[difficulty].label}</span>
            <span className="difficulty-picker__meta">{LABELS[difficulty].lanes}</span>
            {!compact && (
              <span className="difficulty-picker__blurb">{LABELS[difficulty].blurb}</span>
            )}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function difficultyLabel(difficulty: Difficulty): string {
  return LABELS[difficulty].label;
}
