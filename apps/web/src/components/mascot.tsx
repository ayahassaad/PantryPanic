"use client";

import { useEffect, useRef, useState } from "react";

// Where each eye socket is centered, in the SVG's own 140x160 coordinate
// space — used both to draw the sockets and as the anchor each pupil's
// tracked offset is added to.
const LEFT_EYE_CENTER = { x: 52, y: 76 };
const RIGHT_EYE_CENTER = { x: 88, y: 74 };
const EYE_SOCKET_RADIUS = 13;
const PUPIL_RADIUS = 5.5;
// How far a pupil can drift from dead-center before it would touch the
// edge of the white socket — keeps it glancing around inside the eye,
// never popping out of it.
const MAX_PUPIL_TRAVEL = EYE_SOCKET_RADIUS - PUPIL_RADIUS - 2;
// Pose before any mouse movement has been tracked (SSR, or a touch
// device that never fires mousemove) — matches the original fixed
// "glancing down-right" pose this mascot always had, so there's no
// visible jump once tracking kicks in.
const REST_OFFSET = { x: 2, y: 3 };

// Panic, the app's mascot — a googly-eyed tomato, hand-drawn (well,
// hand-coded) to match the wobbly-outline style from the visual-direction
// design canvas. Pure SVG so it scales cleanly at any size; pass a
// Tailwind size class (e.g. "h-16 w-14") via className.
//
// A client component because the eyes track the cursor — everything
// else about it is still static markup, so every page that renders it
// (almost all of them, including plain Server Component pages) works
// exactly as before; Next.js is fine with a Server Component rendering
// a Client Component like this one.
export function Mascot({ className }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pupilOffset, setPupilOffset] = useState(REST_OFFSET);

  useEffect(() => {
    // Touch devices have no real cursor to follow, and there's no
    // mousemove to react to anyway — leave the eyes at their resting
    // pose there instead of doing needless work.
    if (window.matchMedia("(pointer: coarse)").matches) {
      return;
    }

    let frame = 0;

    function handleMouseMove(event: MouseEvent) {
      // Coalesce to one update per animation frame — a raw mousemove
      // listener can fire far more often than the screen repaints.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        // Roughly where the face sits within the SVG's own box (the
        // eyes are centered around x=70, y=75 of the 140x160 viewBox),
        // converted to real screen pixels for this particular instance.
        const faceX = rect.left + (rect.width * 70) / 140;
        const faceY = rect.top + (rect.height * 75) / 160;

        const dx = event.clientX - faceX;
        const dy = event.clientY - faceY;
        const distance = Math.hypot(dx, dy) || 1;
        // Pupils point straight at the cursor at essentially any normal
        // distance, and only ease back toward center as the cursor gets
        // very close to the face — dividing by 12 means "close" here is
        // roughly within a couple inches on screen.
        const travel = Math.min(distance / 12, MAX_PUPIL_TRAVEL);

        setPupilOffset({
          x: (dx / distance) * travel,
          y: (dy / distance) * travel,
        });
      });
    }

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  const pupilStyle = {
    transform: `translate(${pupilOffset.x}px, ${pupilOffset.y}px)`,
    transition: "transform 80ms ease-out",
  };

  return (
    <svg
      ref={svgRef}
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
      {/* eyes: googly, pupils tracking the cursor via pupilOffset */}
      <circle
        cx={LEFT_EYE_CENTER.x}
        cy={LEFT_EYE_CENTER.y}
        r={EYE_SOCKET_RADIUS}
        fill="oklch(99% 0.006 85)"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="3"
      />
      <g style={pupilStyle}>
        <circle cx={LEFT_EYE_CENTER.x} cy={LEFT_EYE_CENTER.y} r={PUPIL_RADIUS} fill="oklch(24% 0.03 150)" />
        <circle cx={LEFT_EYE_CENTER.x + 2} cy={LEFT_EYE_CENTER.y - 3} r="1.8" fill="oklch(99% 0.006 85)" />
      </g>
      <circle
        cx={RIGHT_EYE_CENTER.x}
        cy={RIGHT_EYE_CENTER.y}
        r={EYE_SOCKET_RADIUS}
        fill="oklch(99% 0.006 85)"
        stroke="oklch(24% 0.03 150)"
        strokeWidth="3"
      />
      <g style={pupilStyle}>
        <circle cx={RIGHT_EYE_CENTER.x} cy={RIGHT_EYE_CENTER.y} r={PUPIL_RADIUS} fill="oklch(24% 0.03 150)" />
        <circle cx={RIGHT_EYE_CENTER.x + 2} cy={RIGHT_EYE_CENTER.y - 3} r="1.8" fill="oklch(99% 0.006 85)" />
      </g>
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
