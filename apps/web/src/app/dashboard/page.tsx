import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Mascot } from "@/components/mascot";
import { logout } from "./actions";

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
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-8 sm:px-10">
      {/* top bar */}
      <div className="mb-10 flex items-center justify-end sm:mb-14">
        <form>
          <button
            formAction={logout}
            className="border-b-2 border-dashed border-ink-soft text-sm font-bold text-ink-soft transition hover:text-ink"
          >
            Log out
          </button>
        </form>
      </div>

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
  );
}
