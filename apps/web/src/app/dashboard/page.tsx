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

const SIZE_CLASSES = ["h-6 w-6", "h-7 w-7", "h-8 w-8"];

// Only ever used to vary rotation/size/opacity below — never position.
// The previous version of this page scattered doodles with percentage-
// based absolute coordinates, which looked chaotic and could land close
// enough to the centered content column to visually cross into it (the
// margin outside a fixed max-width column isn't a fixed percentage of the
// viewport, so a "10-20% from the edge" doodle can be comfortably clear
// of the content at one width and sitting right on top of it at another).
// This version instead gives every doodle a real flexbox slot in a
// border strip that sits OUTSIDE the content on all four sides — the box
// model itself guarantees a doodle can never overlap the content, and
// `justify-evenly` gives perfectly even spacing for free, no math needed.
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

interface Doodle {
  Shape: DoodleShape;
  sizeClass: string;
  rotate: number;
  opacity: number;
}

// One doodle per slot in a border strip. Shapes cycle in a fixed order
// (not picked randomly) so two neighbors are never the same icon —
// rotation/size/opacity are the only randomized bits, and only ever
// within a gentle range, so nothing looks out of place.
function makeDoodles(count: number, seedOffset: number): Doodle[] {
  return Array.from({ length: count }, (_, i) => {
    const seed = seedOffset + i * 7.13;
    return {
      Shape: SHAPES[(seedOffset + i) % SHAPES.length] ?? DoodleCarrot,
      sizeClass: SIZE_CLASSES[Math.floor(pseudoRandom(seed) * SIZE_CLASSES.length)] ?? "h-7 w-7",
      rotate: Math.round(pseudoRandom(seed + 1) * 30 - 15),
      opacity: pseudoRandom(seed + 2) > 0.7 ? 0.75 : 1,
    };
  });
}

function DoodleStrip({ doodles }: { doodles: Doodle[] }) {
  return (
    <>
      {doodles.map(({ Shape, sizeClass, rotate, opacity }, i) => (
        <Shape
          key={i}
          className={`pointer-events-none flex-none ${sizeClass}`}
          style={{ transform: `rotate(${rotate}deg)`, opacity }}
        />
      ))}
    </>
  );
}

// Fixed, not random, per strip — a top/bottom row spans the full page
// width so 6 reads as a comfortably even row; a left/right column only
// has as much height as the content beside it, so 4 keeps it from
// looking cramped. Distinct seed offsets per strip just keep the four
// strips' shape/rotation patterns from repeating in lockstep.
const TOP_DOODLES = makeDoodles(6, 10);
const BOTTOM_DOODLES = makeDoodles(6, 100);
const LEFT_DOODLES = makeDoodles(4, 200);
const RIGHT_DOODLES = makeDoodles(4, 300);

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
    <div className="relative">
      {/* Top border strip — full page width, sits above the content row
          entirely (its own flex row, not overlapping anything below it).
          Hidden below sm: there's no spare room on a phone-width screen
          for a "frame" to read as one, so it's better hidden than
          crowded. */}
      <div
        aria-hidden
        className="hidden h-14 items-center justify-evenly overflow-hidden px-6 sm:flex"
      >
        <DoodleStrip doodles={TOP_DOODLES} />
      </div>

      {/* Middle row: fixed-width side strips flank the content column.
          align-items defaults to stretch, so each side strip's height
          matches the content column's actual height automatically —
          whatever that turns out to be, the doodles inside still spread
          evenly across it via justify-evenly. justify-center on this row
          keeps the content column centered exactly as it was under its
          own mx-auto before, whether or not the side strips are present. */}
      <div className="flex justify-center">
        <div
          aria-hidden
          className="hidden w-20 flex-none flex-col items-center justify-evenly py-10 xl:flex"
        >
          <DoodleStrip doodles={LEFT_DOODLES} />
        </div>

        <main className="w-full max-w-5xl px-6 py-8 sm:px-10">
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

        <div
          aria-hidden
          className="hidden w-20 flex-none flex-col items-center justify-evenly py-10 xl:flex"
        >
          <DoodleStrip doodles={RIGHT_DOODLES} />
        </div>
      </div>

      {/* Bottom border strip — mirrors the top one. */}
      <div
        aria-hidden
        className="hidden h-14 items-center justify-evenly overflow-hidden px-6 sm:flex"
      >
        <DoodleStrip doodles={BOTTOM_DOODLES} />
      </div>
    </div>
  );
}
