import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

// Same scatter approach as the login page's background (see login/page.tsx
// for the fuller writeup) — deterministic, not Math.random(), since this
// is server-rendered and a value that differed between the server render
// and the browser's hydration pass would throw a hydration-mismatch
// error. Duplicated here rather than shared: the two pages' safe zones
// (a narrow centered card vs. a wide hero + 3-column card grid) are
// different enough that the depth ranges below aren't reusable as-is,
// and the whole thing is short enough that a shared helper module would
// mostly add an indirection.
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function scatterBand(
  band: "top" | "bottom" | "left" | "right",
  count: number,
  tierClass: string,
  depthRange: [number, number],
  seedOffset: number,
): DoodlePlacement[] {
  const placements: DoodlePlacement[] = [];
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

// Dashboard content is wider than the login card (a max-w-5xl hero +
// 3-column grid vs. a max-w-sm card), so left/right bands wait until
// there's real margin outside that content to scatter into — same
// breakpoint logic as login/page.tsx, just starting one step later
// (`lg:` instead of `md:`) since the content itself is wider here.
const DOODLE_PLACEMENTS: DoodlePlacement[] = [
  ...scatterBand("top", 3, "", [1, 4], 1),
  ...scatterBand("bottom", 3, "", [1, 4], 100),

  ...scatterBand("top", 6, "hidden sm:block", [3, 8], 200),
  ...scatterBand("bottom", 6, "hidden sm:block", [3, 8], 300),

  ...scatterBand("left", 6, "hidden lg:block", [1, 10], 400),
  ...scatterBand("right", 6, "hidden lg:block", [1, 10], 500),

  ...scatterBand("left", 6, "hidden xl:block", [10, 20], 600),
  ...scatterBand("right", 6, "hidden xl:block", [10, 20], 700),
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // full_name is optional (set at signup, editable on the profile page) —
  // fall back to the part of the email before the @ so the greeting is
  // never blank.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null }>();

  const firstName = (profile?.full_name?.trim().split(" ")[0] || user.email?.split("@")[0]) ?? "there";

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Decorative food doodles, scattered around the hero + cards —
          same idea as the login page's background. Direct child of this
          full-width wrapper (not of <main>, which is width-capped and
          centered) so the scatter bands below are positioned against the
          actual viewport edges, same as login/page.tsx. */}
      {DOODLE_PLACEMENTS.map(({ Shape, tierClass, sizeClass, style }, index) => (
        <Shape
          key={index}
          className={`pointer-events-none absolute ${tierClass} ${sizeClass}`}
          style={style}
        />
      ))}

      <main className="relative mx-auto max-w-5xl px-6 py-8 sm:px-10">
      {/* hero */}
      <div className="mb-10 flex flex-col items-center gap-6 text-center sm:mb-14 sm:flex-row sm:items-center sm:gap-10 sm:text-left">
        <Mascot className="h-40 w-36 flex-none" />
        <div>
          <h1 className="-rotate-[0.5deg] font-display text-3xl font-bold leading-tight text-ink sm:text-5xl">
            Hey {firstName}, what&apos;s cooking this week?
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-ink-soft sm:mx-0 sm:text-lg">
            Plan your dinners, wrangle a shopping list, and never stand in
            front of the fridge wondering again.
          </p>
        </div>
      </div>

      {/* action cards */}
      <div className="grid gap-5 sm:grid-cols-3">
        <Link
          href="/recipes"
          className="wobble-a hand-shadow relative -rotate-1 bg-tomato-400 p-6 transition duration-150 hover:z-10 hover:-translate-y-2 hover:scale-105 hover:rotate-0 hover:shadow-[8px_8px_0_oklch(24%_0.03_150)] hover:brightness-105 active:translate-y-0 active:scale-100"
        >
          <svg width="30" height="30" viewBox="0 0 34 34" className="mb-3">
            <path
              d="M6,30 L6,10 C6,7 8,5 11,5 L23,5 C26,5 28,7 28,10 L28,30"
              fill="none"
              stroke="oklch(99% 0.006 85)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path d="M6,14 L28,14" stroke="oklch(99% 0.006 85)" strokeWidth="2.5" />
            <path
              d="M12,5 L12,2 M22,5 L22,2"
              stroke="oklch(99% 0.006 85)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <p className="font-display text-xl font-semibold text-cream">Browse recipes</p>
          <p className="mt-1 text-sm text-cream" style={{ opacity: 0.9 }}>
            Your library, favorites, and AI ideas
          </p>
        </Link>

        <Link
          href="/planner"
          className="wobble-b hand-shadow relative rotate-1 bg-leaf-400 p-6 transition duration-150 hover:z-10 hover:-translate-y-2 hover:scale-105 hover:rotate-0 hover:shadow-[8px_8px_0_oklch(24%_0.03_150)] hover:brightness-105 active:translate-y-0 active:scale-100"
        >
          <svg width="30" height="30" viewBox="0 0 34 34" className="mb-3">
            <rect x="4" y="6" width="26" height="24" rx="3" fill="none" stroke="oklch(99% 0.006 85)" strokeWidth="2.5" />
            <path d="M4,13 L30,13" stroke="oklch(99% 0.006 85)" strokeWidth="2.5" />
            <path
              d="M10,3 L10,8 M24,3 L24,8"
              stroke="oklch(99% 0.006 85)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <p className="font-display text-xl font-semibold text-cream">Meal planner</p>
          <p className="mt-1 text-sm text-cream" style={{ opacity: 0.9 }}>
            Fill the week, one slot at a time
          </p>
        </Link>

        <Link
          href="/profile"
          className="wobble-a hand-shadow relative -rotate-[0.6deg] bg-citrus-400 p-6 transition duration-150 hover:z-10 hover:-translate-y-2 hover:scale-105 hover:rotate-0 hover:shadow-[8px_8px_0_oklch(24%_0.03_150)] hover:brightness-105 active:translate-y-0 active:scale-100"
        >
          <svg width="30" height="30" viewBox="0 0 34 34" className="mb-3">
            <circle cx="17" cy="11" r="6" fill="none" stroke="oklch(24% 0.03 150)" strokeWidth="2.5" />
            <path
              d="M5,30 C5,21 10,17 17,17 C24,17 29,21 29,30"
              fill="none"
              stroke="oklch(24% 0.03 150)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <p className="font-display text-xl font-semibold text-ink">Edit profile</p>
          <p className="mt-1 text-sm text-ink-soft">Allergies &amp; what you won&apos;t eat</p>
        </Link>
      </div>
      </main>
    </div>
  );
}
