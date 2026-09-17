import Link from "next/link";
import { Mascot } from "@/components/mascot";
import { login } from "./actions";

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
      {/* Decorative doodles, echoed from the style-guide mockup — only
          shown where there's actual margin around the card to sit in. */}
      <svg
        className="pointer-events-none absolute left-[8%] top-20 hidden sm:block"
        width="40"
        height="40"
        viewBox="0 0 46 46"
        aria-hidden="true"
      >
        <path
          d="M23,2 L28,17 L44,17 L31,27 L36,42 L23,33 L10,42 L15,27 L2,17 L18,17 Z"
          fill="oklch(80% 0.15 95)"
          stroke="oklch(24% 0.03 150)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          transform="rotate(-8 23 23)"
        />
      </svg>
      <svg
        className="pointer-events-none absolute bottom-28 right-[9%] hidden sm:block"
        width="32"
        height="32"
        viewBox="0 0 34 34"
        aria-hidden="true"
      >
        <path
          d="M4,17 C4,17 12,4 17,4 C22,4 30,17 30,17 C30,17 22,30 17,30 C12,30 4,17 4,17 Z"
          fill="none"
          stroke="oklch(52% 0.13 290)"
          strokeWidth="2.5"
        />
      </svg>
      <svg
        className="pointer-events-none absolute right-[7%] top-1/3 hidden lg:block"
        width="70"
        height="14"
        viewBox="0 0 70 14"
        aria-hidden="true"
      >
        <path
          d="M0,7 C10,-2 20,16 30,7 C40,-2 50,16 60,7 C64,4 68,10 70,7"
          fill="none"
          stroke="oklch(68% 0.17 55)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>

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
