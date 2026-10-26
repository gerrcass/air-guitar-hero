import type { Lane } from "../game/types";

const DEFAULT_COLORS = ["#3ddc84", "#ff4d5e", "#ffe14d", "#4da6ff", "#ff9f43"] as const;
const COLORBLIND_COLORS = ["#4da3ff", "#ff9f1c", "#ffe66d", "#2ee6a8", "#ff5cc8"] as const;
const SYMBOLS = ["●", "◆", "▲", "■", "★"] as const;

export function laneColor(lane: Lane, colorblind: boolean): string {
  return (colorblind ? COLORBLIND_COLORS[lane] : DEFAULT_COLORS[lane]) ?? "#ffffff";
}

export function laneSymbol(lane: Lane): string {
  return SYMBOLS[lane] ?? "●";
}

export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(
    clean.length === 3
      ? clean
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : clean,
    16,
  );
  if (!Number.isFinite(value)) return `rgba(255,255,255,${alpha})`;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
