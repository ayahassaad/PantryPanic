import type { CSSProperties } from "react";
import Link from "next/link";
import { Mascot } from "@/components/mascot";
import {
  DoodleBroccoli,
  DoodleCarrot,
  DoodleCheeseWedge,
  DoodleCitrusSlice,
  DoodleEgg,
  DoodleGrapes,
  DoodleLeafSprig,
  DoodleMug,
  DoodlePepper,
} from "@/components/food-doodles";
import { login } from "./actions";

type DoodleShape = (props: { className?: string; style?: CSSProperties }) => JSX.Element;

interface DoodlePlacement {
  Shape: DoodleShape;
  tierClass: string;
  sizeClass: string;
  style: CSSProperties;
}

const SHAPES: DoodleShape[] = [
  DoodleCarrot,
  DoodleCitrusSlice,
  DoodleBroccoli,
  DoodleEgg,
  DoodlePepper,
  DoodleGrapes,
  DoodleMug,
  DoodleLeafSprig,
  DoodleCheeseWedge,
];

const SIZE_CLASSES = ["h-6 w-6", "h-7 w-7", "h-8 w-8", "h-9 w-9"];

// A tiny deterministic "random" generator — not Math.random(). This page
// is server-rendered, and a value that came out different between the
// server's render and the browser's hydration pass would throw a
// hydration-mismatch error. Same seed always gives the same number, so
// the scatter is stable across reloads but still looks organic rather
// than gridded.
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Scatters `count` doodles in a band that hugs one edge of the page —
// "top"/"bottom" run along the full width near that edge, "left"/"right"
// run along the full height near that edge. `depthRange` is how far
// into the page that band reaches, as a percent of the page — kept
// small enough (see the callers below) that the band never reaches the
// centered card or the "New here?" line under it, on any real browser
// window, so there's no overlap-checking to do.
function scatterBand(
  band: "top" | "bottom" | "left" | "right",
  count: number,
  tierClass: string,
  depthRange: [number, number],
  seedOffset: number,
): DoodlePlacement[] {
  const placements: DoodlePlacement[] = [];
  // The along-axis (98% usable, from 2% to 98%) is divided into one
  // slot per doodle, and each one is jittered a bit within its own
  // slot. Picking a fully random spot for all `count` of them tends to
  // clump a few together and leave gaps elsewhere — evenly-spaced slots
  // with a little jitter still look organic but guarantee spacing.
  const slotWidth = 96 / count;

  for (let i = 0; i < count; i++) {
    const seed = seedOffset + i * 13.37;
    const jitter = (pseudoRandom(seed) - 0.5) * slotWidth * 0.7;
    const along = 2 + slotWidth * (i + 0.5) + jitter;
    const depth = depthRange[0] + pseudoRandom(seed + 1) * (depthRange[1] - depthRange[0]);
    const rotate = Math.round(pseudoRandom(seed + 2) * 30 - 15);
    const shape = SHAPES[Math.floor(pseudoRandom(seed + 3) * SHAPES.length)] ?? DoodleCarrot;
    const sizeClass = SIZE_CLASSES[Math.floor(pseudoRandom(seed + 4) * SIZE_CLASSES.length)] ?? "h-7 w-7";
    const opacity = pseudoRandom(seed + 5) > 0.75 ? 0.8 : 1;

    const style: CSSProperties = { transform: `rotate(${rotate}deg)`, opacity };
    if (band === "top") {
      style.top = `${depth}%`;
      style.left = `${along}%`;
    } else if (band === "bottom") {
      style.bottom = `${depth}%`;
      style.left = `${along}%`;
    } else if (band === "left") {
      style.left = `${depth}%`;
      style.top = `${along}%`;
    } else {
      style.right = `${depth}%`;
      style.top = `${along}%`;
    }

    placements.push({ Shape: shape, tierClass, sizeClass, style });
  }

  return placements;
}

// About 3x the original scatter, laid out in layers that only turn on
// once there's real room for them:
//
// - top/bottom depth stays under ~9% of the viewport height even at the
//   widest layer, which stays clear of the card + the "New here?" line
//   below it even on a short laptop window (~700px tall, where the card
//   and footer together eat up most of the middle ~550px, leaving only
//   ~75px = ~10.7% above and below).
// - left/right bands don't turn on until `md:` (768px) rather than
//   `sm:` (640px) — at 640px wide, the card's own 384px width leaves so
//   little side margin that even a small depth would touch it; 768px+
//   gives enough breathing room, and the `lg:` layer sits deeper still.
//
// Each `scatterBand` call is one layer — tune the counts/ranges here to
// make the page busier, calmer, or adjust the safe margins.
const DOODLE_PLACEMENTS: DoodlePlacement[] = [
  ...scatterBand("top", 3, "", [1, 4], 1),
  ...scatterBand("bottom", 3, "", [1, 4], 100),

  ...scatterBand("top", 8, "hidden sm:block", [3, 9], 200),
  ...scatterBand("bottom", 8, "hidden sm:block", [3, 9], 300),

  ...scatterBand("left", 8, "hidden md:block", [1, 14], 400),
  ...scatterBand("right", 8, "hidden md:block", [1, 14], 500),

  ...scatterBand("left", 8, "hidden lg:block", [14, 24], 600),
  ...scatterBand("right", 8, "hidden lg:block", [14, 24], 700),
];

// Rotates by day of week so the page has a little personality without
// any client-side randomness (which would risk a hydration mismatch on
// this server-rendered page). Purely cosmetic — same visitor sees the
// same one all day.
const TAGLINES = [
  "Panic missed you",
  "Back for more chaos?",
  "Welcome back",
  "The pantry awaits",
  "Ready to out-plan dinner?",
  "Let's get cooking again",
  "Your fridge called, it's worried",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  const tagline = TAGLINES[new Date().getDay() % TAGLINES.length] ?? "Welcome back";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      {/* Decorative food doodles, scattered around the card. Each is a
          shape from food-doodles.tsx; DOODLE_PLACEMENTS above says where
          (as an edge band, so it can't overlap the card), how big, and
          from which breakpoint up it appears. */}
      {DOODLE_PLACEMENTS.map(({ Shape, tierClass, sizeClass, style }, index) => (
        <Shape
          key={index}
          className={`pointer-events-none absolute ${tierClass} ${sizeClass}`}
          style={style}
        />
      ))}

      <div className="w-full max-w-sm">
        <div className="wobble-a hand-shadow border-2 border-ink bg-cream-card p-8">
          <Mascot className="mascot-wiggle mx-auto mb-5 h-16 w-14" />
          <p className="mb-1 text-center font-display text-xs font-semibold uppercase tracking-widest text-tomato-400">
            {tagline}
          </p>
          <h1 className="mb-7 text-center font-display text-3xl font-bold text-ink">
            Log in
          </h1>

          {error && (
            <p className="wobble-btn mb-6 border-2 border-ink bg-tomato-50 px-4 py-3 text-sm font-bold text-tomato-700">
              {error}
            </p>
          )}

          {notice && !error && (
            <p className="wobble-btn mb-6 border-2 border-ink bg-leaf-50 px-4 py-3 text-sm font-bold text-leaf-700">
              {notice}
            </p>
          )}

          <form className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                className="rounded-xl border-2 border-ink-faint bg-cream-deep px-4 py-2.5 text-base text-ink outline-none focus:border-ink"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                className="rounded-xl border-2 border-ink-faint bg-cream-deep px-4 py-2.5 text-base text-ink outline-none focus:border-ink"
              />
            </label>
            <button
              formAction={login}
              className="wobble-btn hand-shadow mt-2 bg-tomato-400 px-4 py-2.5 font-display text-sm font-semibold text-cream transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:rotate-1 hover:brightness-105 active:translate-x-0 active:translate-y-0"
            >
              Log in
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm font-bold text-ink-soft">
          New here?{" "}
          <Link
            href="/signup"
            className="border-b-2 border-dashed border-tomato-400 text-ink transition hover:text-tomato-600"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
