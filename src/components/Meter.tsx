import type { JSX } from "react";

export function Meter({
  label,
  value,
  tone = "rock",
  detail,
}: {
  readonly label: string;
  /** 0…1 */
  readonly value: number;
  readonly tone?: "rock" | "star" | "progress";
  readonly detail?: string;
}): JSX.Element {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={`meter meter--${tone}`}>
      <div className="meter__header">
        <span className="meter__label">{label}</span>
        <span className="meter__detail">{detail ?? `${percent}%`}</span>
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: the custom track needs a styled inner fill. */}
      <div
        className="meter__track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={detail ?? `${percent} percent`}
      >
        <span className="meter__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
