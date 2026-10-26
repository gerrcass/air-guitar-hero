import type { JSX } from "react";

export function Stars({
  value,
  max = 5,
  label,
}: {
  readonly value: number;
  readonly max?: number;
  readonly label?: string;
}): JSX.Element {
  const filled = Math.max(0, Math.min(max, Math.round(value)));
  return (
    <span className="stars" role="img" aria-label={label ?? `${filled} of ${max} stars`}>
      {Array.from({ length: max }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={index < filled ? "stars__item stars__item--on" : "stars__item"}
        >
          ★
        </span>
      ))}
    </span>
  );
}
