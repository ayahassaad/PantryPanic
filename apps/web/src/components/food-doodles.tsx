// A small library of hand-drawn food icons, in the same thick-outline,
// flat-color style as the mascot. Kept as plain, stateless shapes (no
// hooks) so they're safe to render from Server Components — pages just
// scatter instances of these around as background decoration.
//
// Each one takes only `className`, so sizing/position/rotation/opacity
// are all controlled from wherever it's placed, the same way you'd size
// an <img>.

import type { CSSProperties } from "react";

type DoodleProps = { className?: string; style?: CSSProperties };

export function DoodleCarrot({ className, style }: DoodleProps) {
  return (
    <svg viewBox="0 0 40 48" className={className} style={style} aria-hidden="true">
      <path
        d="M20,46 C14,40 10,28 10,16 C10,14 14,13 20,13 C26,13 30,14 30,16 C30,28 26,40 20,46 Z"
        fill="oklch(68% 0.17 55)"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M20,13 C17,6 12,4 7,5 M20,13 C20,5 21,2 22,0 M20,13 C23,6 28,4 33,5"
        fill="none"
        stroke="oklch(48% 0.12 145)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DoodleCitrusSlice({ className, style }: DoodleProps) {
  return (
    <svg viewBox="0 0 40 40" className={className} style={style} aria-hidden="true">
      <circle
        cx="20"
        cy="20"
        r="18"
        fill="oklch(80% 0.15 95)"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="2.2"
      />
      <circle cx="20" cy="20" r="13" fill="none" stroke="oklch(99% 0.006 85)" strokeWidth="2" />
      <path
        d="M20,20 L33,20 M20,20 L26.5,31.3 M20,20 L13.5,31.3 M20,20 L7,20 M20,20 L13.5,8.7 M20,20 L26.5,8.7"
        stroke="oklch(99% 0.006 85)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DoodleBroccoli({ className, style }: DoodleProps) {
  return (
    <svg viewBox="0 0 40 44" className={className} style={style} aria-hidden="true">
      <rect
        x="16"
        y="28"
        width="8"
        height="13"
        rx="2"
        fill="oklch(93% 0.03 85)"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="2.2"
      />
      <circle cx="14" cy="19" r="10" fill="oklch(62% 0.13 145)" stroke="oklch(24% 0.03 150)" strokeWidth="2.2" />
      <circle cx="26" cy="19" r="10" fill="oklch(62% 0.13 145)" stroke="oklch(24% 0.03 150)" strokeWidth="2.2" />
      <circle cx="20" cy="11" r="10" fill="oklch(62% 0.13 145)" stroke="oklch(24% 0.03 150)" strokeWidth="2.2" />
    </svg>
  );
}

export function DoodleEgg({ className, style }: DoodleProps) {
  return (
    <svg viewBox="0 0 34 44" className={className} style={style} aria-hidden="true">
      <ellipse
        cx="17"
        cy="24"
        rx="14"
        ry="18"
        fill="oklch(99% 0.006 85)"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="2.2"
      />
      <circle cx="13" cy="20" r="5" fill="oklch(80% 0.15 95)" stroke="oklch(24% 0.03 150)" strokeWidth="1.5" />
    </svg>
  );
}

export function DoodlePepper({ className, style }: DoodleProps) {
  return (
    <svg viewBox="0 0 36 44" className={className} style={style} aria-hidden="true">
      <path
        d="M18,42 C8,42 4,32 6,22 C7,15 12,10 18,10 C24,10 29,15 30,22 C32,32 28,42 18,42 Z"
        fill="oklch(62% 0.19 25)"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M18,10 C17,6 15,4 12,3"
        fill="none"
        stroke="oklch(48% 0.12 145)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Typed as fixed-length tuples (not plain number[]) so destructuring each
// one below gives `number`, not `number | undefined` — noUncheckedIndexedAccess
// in tsconfig applies to any indexed access, destructuring included, unless
// the source is a known-length tuple.
const GRAPE_POSITIONS: Array<[number, number]> = [
  [17, 11],
  [10, 18],
  [24, 18],
  [6, 27],
  [17, 28],
  [28, 27],
];

export function DoodleGrapes({ className, style }: DoodleProps) {
  return (
    <svg viewBox="0 0 34 40" className={className} style={style} aria-hidden="true">
      <path
        d="M17,10 C17,7 16,4 14,2"
        fill="none"
        stroke="oklch(48% 0.12 145)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {GRAPE_POSITIONS.map(([cx, cy]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="5"
          fill="oklch(52% 0.13 290)"
          stroke="oklch(24% 0.03 150)"
          strokeWidth="1.8"
        />
      ))}
    </svg>
  );
}

export function DoodleMug({ className, style }: DoodleProps) {
  return (
    <svg viewBox="0 0 40 36" className={className} style={style} aria-hidden="true">
      <rect
        x="8"
        y="10"
        width="20"
        height="18"
        rx="3"
        fill="oklch(99% 0.006 85)"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="2.2"
      />
      <path
        d="M28,15 C34,15 34,23 28,23"
        fill="none"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="2.2"
      />
      <path
        d="M14,8 C12,5 16,4 14,1 M22,8 C20,5 24,4 22,1"
        fill="none"
        stroke="oklch(45% 0.02 150)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DoodleLeafSprig({ className, style }: DoodleProps) {
  return (
    <svg viewBox="0 0 30 30" className={className} style={style} aria-hidden="true">
      <path
        d="M15,28 C15,20 15,12 15,4"
        stroke="oklch(48% 0.12 145)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse
        cx="20"
        cy="14"
        rx="6"
        ry="3"
        fill="oklch(62% 0.13 145)"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="1.8"
        transform="rotate(-30 20 14)"
      />
      <ellipse
        cx="10"
        cy="20"
        rx="6"
        ry="3"
        fill="oklch(62% 0.13 145)"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="1.8"
        transform="rotate(30 10 20)"
      />
    </svg>
  );
}

export function DoodleCheeseWedge({ className, style }: DoodleProps) {
  return (
    <svg viewBox="0 0 40 34" className={className} style={style} aria-hidden="true">
      <path
        d="M4,30 L20,4 L36,30 Z"
        fill="oklch(68% 0.17 55)"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="20" r="2.5" fill="oklch(97% 0.018 85)" />
      <circle cx="26" cy="24" r="2" fill="oklch(97% 0.018 85)" />
      <circle cx="14" cy="26" r="1.8" fill="oklch(97% 0.018 85)" />
    </svg>
  );
}
