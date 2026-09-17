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

// Where each doodle sits, at what size, and from what breakpoint up it
// shows. Two tiny ones (index 0-1) are visible everywhere, tucked into
// corners far enough from the centered card to never collide with it;
// the rest layer in as there's more room (sm, then md, then lg), which
// is also what keeps a phone screen from feeling cluttered while a wide
// desktop gets the full "doodles all over" effect.
const DOODLE_PLACEMENTS: { Shape: (props: { className?: string }) => JSX.Element; className: string }[] = [
  { Shape: DoodleCitrusSlice, className: "absolute left-3 top-3 h-6 w-6" },
  { Shape: DoodleLeafSprig, className: "absolute bottom-3 right-3 h-6 w-6" },

  { Shape: DoodleCarrot, className: "hidden sm:block absolute left-[10%] top-10 h-9 w-9 -rotate-6" },
  { Shape: DoodleBroccoli, className: "hidden sm:block absolute right-[8%] top-14 h-9 w-9 rotate-3" },
  { Shape: DoodleGrapes, className: "hidden sm:block absolute left-[8%] bottom-16 h-8 w-8 rotate-6" },
  { Shape: DoodleMug, className: "hidden sm:block absolute right-[10%] bottom-12 h-9 w-9 -rotate-3" },
  { Shape: DoodleEgg, className: "hidden sm:block absolute left-[4%] top-1/4 h-7 w-7 rotate-12" },
  { Shape: DoodleCheeseWedge, className: "hidden sm:block absolute right-[4%] bottom-1/4 h-8 w-8 -rotate-6" },

  { Shape: DoodleCitrusSlice, className: "hidden md:block absolute right-[14%] top-1/3 h-6 w-6 rotate-12 opacity-90" },
  { Shape: DoodleCarrot, className: "hidden md:block absolute left-[14%] bottom-1/3 h-7 w-7 rotate-12 opacity-90" },
  { Shape: DoodleLeafSprig, className: "hidden md:block absolute right-[20%] top-[6%] h-6 w-6 -rotate-12" },
  { Shape: DoodlePepper, className: "hidden md:block absolute left-[3%] top-[45%] h-8 w-8 rotate-6" },
  { Shape: DoodleMug, className: "hidden md:block absolute right-[3%] top-[55%] h-7 w-7 rotate-6" },

  { Shape: DoodleBroccoli, className: "hidden lg:block absolute left-[22%] top-[15%] h-7 w-7 -rotate-6 opacity-80" },
  { Shape: DoodleGrapes, className: "hidden lg:block absolute right-[22%] bottom-[15%] h-7 w-7 rotate-12 opacity-80" },
  { Shape: DoodleEgg, className: "hidden lg:block absolute left-[18%] top-[60%] h-6 w-6 -rotate-12 opacity-80" },
  { Shape: DoodleCheeseWedge, className: "hidden lg:block absolute right-[18%] bottom-[55%] h-6 w-6 rotate-6 opacity-80" },
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
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const tagline = TAGLINES[new Date().getDay() % TAGLINES.length] ?? "Welcome back";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      {/* Decorative food doodles, scattered around the card. Each is a
          shape from food-doodles.tsx; DOODLE_PLACEMENTS above just says
          where, how big, and from which breakpoint up it appears. */}
      {DOODLE_PLACEMENTS.map(({ Shape, className }, index) => (
        <Shape key={index} className={`pointer-events-none ${className}`} />
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
