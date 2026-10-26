import { type JSX, useId } from "react";
import type { SongDefinition } from "../content/types";

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function AlbumArt({ song }: { readonly song: SongDefinition }): JSX.Element {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, "");
  const random = seeded(song.seed);
  const rings = song.seed % 4;
  const bars = Array.from({ length: 7 }, () => ({
    x: 20 + random() * 360,
    width: 4 + random() * 18,
    height: 40 + random() * 260,
  }));
  const dots = Array.from({ length: 12 }, () => ({
    x: 30 + random() * 340,
    y: 30 + random() * 340,
    r: 1 + random() * 5,
  }));
  const rotation = (song.seed % 60) - 30;

  return (
    <svg
      className="album-art"
      viewBox="0 0 400 400"
      role="img"
      aria-label={`Album art for ${song.title} by ${song.artist}`}
    >
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={song.palette.background} />
          <stop offset="0.55" stopColor={song.palette.primary} stopOpacity="0.5" />
          <stop offset="1" stopColor={song.palette.secondary} stopOpacity="0.8" />
        </linearGradient>
        <radialGradient id={`sun-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={song.palette.accent} stopOpacity="0.95" />
          <stop offset="0.6" stopColor={song.palette.primary} stopOpacity="0.55" />
          <stop offset="1" stopColor={song.palette.primary} stopOpacity="0" />
        </radialGradient>
        <pattern id={`grid-${uid}`} width="26" height="26" patternUnits="userSpaceOnUse">
          <path
            d="M 26 0 L 0 0 0 26"
            fill="none"
            stroke={song.palette.ink}
            strokeOpacity="0.09"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="400" height="400" fill={`url(#bg-${uid})`} />
      <rect width="400" height="400" fill={`url(#grid-${uid})`} />
      <circle
        cx={120 + (song.seed % 160)}
        cy={130 + (song.seed % 90)}
        r={110}
        fill={`url(#sun-${uid})`}
      />
      <g transform={`rotate(${rotation} 200 200)`}>
        {bars.map((bar, index) => (
          <rect
            key={index}
            x={bar.x}
            y={200 - bar.height / 2}
            width={bar.width}
            height={bar.height}
            rx={bar.width / 2}
            fill={index % 2 === 0 ? song.palette.ink : song.palette.accent}
            opacity={0.14 + (index % 3) * 0.08}
          />
        ))}
      </g>
      {Array.from({ length: rings }, (_, index) => (
        <circle
          key={index}
          cx="200"
          cy="200"
          r={70 + index * 34}
          fill="none"
          stroke={song.palette.ink}
          strokeOpacity={0.18 - index * 0.03}
          strokeWidth="1.5"
        />
      ))}
      {dots.map((dot, index) => (
        <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill={song.palette.ink} opacity={0.4} />
      ))}
      <path d="M0 320 L400 250 L400 400 L0 400 Z" fill={song.palette.background} opacity="0.55" />
    </svg>
  );
}
