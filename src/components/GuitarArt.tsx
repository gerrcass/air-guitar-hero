import type { GuitarFinish } from "../state/cosmetics";

export function GuitarArt({ guitar }: { readonly guitar: GuitarFinish }): React.JSX.Element {
  return (
    <svg
      className="guitar-art"
      viewBox="0 0 220 90"
      role="img"
      aria-label={`${guitar.name} guitar finish`}
    >
      <g transform="rotate(-7 110 45)">
        <rect x="128" y="38" width="82" height="9" rx="3" fill="#2a2118" />
        <rect x="198" y="33" width="14" height="19" rx="3" fill={guitar.trim} />
        <circle cx="142" cy="42.5" r="2.4" fill={guitar.trim} />
        <circle cx="152" cy="42.5" r="2.4" fill={guitar.trim} />
        <circle cx="162" cy="42.5" r="2.4" fill={guitar.trim} />
        <path
          d="M64 25c13-8 28-3 30 8 1 6-2 10-7 12 6 5 8 12 3 18-7 9-24 9-33 1-8-7-12-16-9-25 2-7 8-11 16-14z"
          fill={guitar.body}
          stroke="#08090c"
          strokeWidth="3"
        />
        <path
          d="M68 31c7-4 16-2 18 4 1 4-1 7-5 8 4 3 5 8 2 12-4 5-13 5-18 0-4-4-6-9-4-14 1-4 4-7 7-10z"
          fill={guitar.pickguard}
          opacity="0.82"
        />
        <circle cx="75" cy="42" r="5" fill="#0b0c10" />
        <rect x="73" y="46" width="4" height="18" rx="1" fill="#0b0c10" />
        <rect x="76" y="47" width="10" height="3" rx="1" fill={guitar.trim} />
        <path
          d="M58 18l7 18M52 50l13 2M88 20l-5 16"
          stroke={guitar.trim}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
