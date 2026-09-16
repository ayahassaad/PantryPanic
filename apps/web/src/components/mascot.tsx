// Panic, the app's mascot — a googly-eyed tomato, hand-drawn (well,
// hand-coded) to match the wobbly-outline style from the visual-direction
// design canvas. Pure SVG so it scales cleanly at any size; pass a
// Tailwind size class (e.g. "h-16 w-14") via className.
export function Mascot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 140 160"
      className={className}
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      {/* back leg */}
      <path
        d="M55,118 C50,132 44,140 34,146"
        fill="none"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <ellipse
        cx="30"
        cy="149"
        rx="10"
        ry="5"
        fill="oklch(24% 0.03 150)"
        transform="rotate(-18 30 149)"
      />
      {/* front leg */}
      <path
        d="M82,120 C90,133 98,140 108,145"
        fill="none"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <ellipse
        cx="112"
        cy="148"
        rx="10"
        ry="5"
        fill="oklch(24% 0.03 150)"
        transform="rotate(18 112 148)"
      />
      {/* waving arm */}
      <path
        d="M92,72 C112,64 122,46 118,28"
        fill="none"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle
        cx="119"
        cy="24"
        r="7"
        fill="oklch(97% 0.018 85)"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="3.5"
      />
      {/* resting arm */}
      <path
        d="M46,80 C30,90 20,92 10,88"
        fill="none"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle
        cx="8"
        cy="86"
        r="7"
        fill="oklch(97% 0.018 85)"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="3.5"
      />
      {/* leafy top */}
      <path
        d="M70,26 C64,10 54,4 44,8 C52,14 55,20 55,26 Z"
        fill="oklch(62% 0.13 145)"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M70,24 C70,6 78,-2 90,0 C82,8 78,15 76,24 Z"
        fill="oklch(62% 0.13 145)"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M74,26 C82,12 94,8 102,14 C92,18 87,23 82,29 Z"
        fill="oklch(62% 0.13 145)"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* body: wobbly tomato blob */}
      <path
        d="M70,30 C98,28 120,52 118,80 C116,110 96,132 68,130 C38,128 16,106 18,78 C20,50 42,32 70,30 Z"
        fill="oklch(62% 0.19 25)"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      {/* cheek blush */}
      <ellipse cx="38" cy="90" rx="9" ry="6" fill="oklch(68% 0.17 55)" opacity="0.75" />
      <ellipse cx="100" cy="88" rx="9" ry="6" fill="oklch(68% 0.17 55)" opacity="0.75" />
      {/* eyes: googly */}
      <circle
        cx="52"
        cy="76"
        r="13"
        fill="oklch(99% 0.006 85)"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="3"
      />
      <circle cx="54" cy="79" r="5.5" fill="oklch(24% 0.03 150)" />
      <circle cx="56" cy="76" r="1.8" fill="oklch(99% 0.006 85)" />
      <circle
        cx="88"
        cy="74"
        r="13"
        fill="oklch(99% 0.006 85)"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="3"
      />
      <circle cx="91" cy="77" r="5.5" fill="oklch(24% 0.03 150)" />
      <circle cx="93" cy="74" r="1.8" fill="oklch(99% 0.006 85)" />
      {/* smile */}
      <path
        d="M56,102 C64,112 76,112 86,101"
        fill="none"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
