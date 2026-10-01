import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MEAL_SLOTS, type MealSlot } from "@pantry-panic/shared";
import { addDays, resolveWeekStart, toISODate } from "@/lib/week";
import { Mascot } from "@/components/mascot";
import { syncShoppingListFromPlanner } from "@/app/shopping-list/actions";

// Same accent per meal slot as the planner grid (breakfast = citrus,
// lunch = leaf, dinner = tomato), so a meal looks the same here as it
// does on the page it was planned on.
const SLOT_STYLES: Record<MealSlot, { label: string; cell: string }> = {
  breakfast: { label: "text-citrus-600", cell: "bg-citrus-400" },
  lunch: { label: "text-leaf-600", cell: "bg-leaf-400" },
  dinner: { label: "text-tomato-600", cell: "bg-tomato-400" },
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface PlanEntry {
  id: string;
  plan_date: string;
  meal_slot: MealSlot;
  servings: number;
  recipe: { id: string; title: string } | null;
}

// How many items are on this week's shopping list, and how many are
// still unticked — the one line of text on the "Shopping list" card. The
// list is only ever rebuilt from the planner when something asks it to
// (see syncShoppingListFromPlanner), so it's synced here first, exactly
// as the shopping list page does on every visit — otherwise a meal added
// since that page was last opened wouldn't be counted, and this card
// would show a number the list itself then contradicts.
//
// Its own async component (rendered inside a <Suspense>) rather than
// part of DashboardPage's own data loading: that sync is several
// database round trips, and nothing else on the page needs its result.
async function ShoppingSummary({ userId, weekStartISO }: { userId: string; weekStartISO: string }) {
  const supabase = await createClient();
  await syncShoppingListFromPlanner(supabase, userId, weekStartISO);

  const { data: list } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start_date", weekStartISO)
    .maybeSingle<{ id: string }>();

  const { data: items } = list
    ? await supabase
        .from("shopping_list_items")
        .select("is_checked")
        .eq("shopping_list_id", list.id)
        .returns<Array<{ is_checked: boolean }>>()
    : { data: null };

  const total = items?.length ?? 0;
  const left = (items ?? []).filter((item) => !item.is_checked).length;

  if (total === 0) {
    return <>Fills itself from your meal plan</>;
  }
  if (left === 0) {
    return <>All {total} items ticked off this week</>;
  }
  return (
    <>
      {left} {left === 1 ? "item" : "items"} left to buy this week
    </>
  );
}

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
    .select("full_name, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null; onboarding_completed_at: string | null }>();

  // The real gate for the signup quiz. auth/callback/route.ts also sends a
  // freshly-confirmed signup here directly, but that route only ever
  // fires when email confirmation requires clicking a link — a Supabase
  // project with confirmations turned off signs someone in immediately on
  // signup, so they can reach the dashboard without ever passing through
  // that route at all. Checking it here instead means the quiz shows up
  // for every new user exactly once no matter which path got them signed
  // in, and never again once onboarding/actions.ts marks it done.
  if (!profile?.onboarding_completed_at) {
    redirect("/onboarding");
  }

  const firstName = (profile?.full_name?.trim().split(" ")[0] || user.email?.split("@")[0]) ?? "there";

  // "Today" is the UTC date, same as the planner's own today marker (see
  // planner/page.tsx) — the two pages have to agree on which day it is.
  const today = new Date();
  const todayISO = toISODate(today);
  const todayLabel = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  // The whole current week (Monday-anchored, same boundaries as the
  // planner), not just today — today's strip and the week summary below
  // are both read out of this one query.
  const weekStart = resolveWeekStart(undefined);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekStartISO = toISODate(weekStart);

  const { data: weekEntries } = await supabase
    .from("meal_plan_entries")
    .select("id, plan_date, meal_slot, servings, recipe:recipes(id, title)")
    .eq("user_id", user.id)
    .gte("plan_date", weekStartISO)
    .lte("plan_date", toISODate(addDays(weekStart, 6)))
    .returns<PlanEntry[]>();

  const todayBySlot = new Map<MealSlot, PlanEntry>();
  const plannedCells = new Set<string>();
  for (const entry of weekEntries ?? []) {
    plannedCells.add(`${entry.plan_date}_${entry.meal_slot}`);
    if (entry.plan_date === todayISO) {
      todayBySlot.set(entry.meal_slot, entry);
    }
  }

  const totalSlots = weekDays.length * MEAL_SLOTS.length;
  const filledSlots = weekEntries?.length ?? 0;

  // The line under the greeting says where the week actually stands,
  // instead of the same pitch on every visit. The original pitch is kept
  // for the one case it still fits: nothing planned at all yet.
  const tonight = todayBySlot.get("dinner")?.recipe?.title ?? null;
  const heroLine =
    filledSlots === totalSlots
      ? `Your whole week is planned. Tonight: ${tonight ?? "dinner's sorted"}.`
      : tonight
        ? `Tonight: ${tonight}.`
        : filledSlots === 0
          ? "Plan your dinners, wrangle a shopping list, and never stand in front of the fridge wondering again."
          : "Nothing planned for tonight yet.";

  return (
    // Uses the whole window rather than a narrow centered column: the
    // same 1600px cap as the planner, and at least the full height under
    // the nav bar. On a wide screen the greeting sits on the left with
    // today + this week beside it, vertically centered in whatever
    // height is left over, and the three big cards run along the bottom.
    // Below xl it all stacks into one column in the same order.
    <main className="mx-auto flex min-h-[calc(100dvh-4.5rem)] w-full max-w-[1600px] flex-col gap-8 px-6 py-8 sm:px-10">
      <div className="grid flex-1 items-center gap-8 xl:grid-cols-2 xl:gap-14">
      {/* hero */}
      <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:gap-10 sm:text-left">
        <Mascot className="h-40 w-36 flex-none 2xl:h-52 2xl:w-[187px]" />
        <div>
          <h1 className="-rotate-[0.5deg] font-display text-3xl font-bold leading-tight text-ink sm:text-5xl 2xl:text-6xl">
            Hey {firstName}, what&apos;s cooking this week?
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-ink-soft sm:mx-0 sm:text-lg">
            {heroLine}
          </p>
          {/* Only while tonight's dinner slot is still empty — a shortcut
              into the existing "Ask AI" form with Dinner already picked
              (see the `meal` param in recipes/suggest/page.tsx). Same
              button style as "Suggest with AI" on the recipes page. */}
          {!todayBySlot.has("dinner") && (
            <Link
              href="/recipes/suggest?meal=dinner"
              className="wobble-btn hand-shadow mt-5 inline-block bg-citrus-400 px-5 py-2.5 font-display text-sm font-semibold text-ink transition hover:brightness-105"
            >
              &#10022; Suggest tonight&apos;s dinner
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
      {/* Today's three meals straight from the planner, so "what am I
          cooking today?" is answered without leaving this page. A planned
          meal links to its recipe; an empty slot links to this week's
          planner to fill it. */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 className="font-display text-2xl font-bold text-ink">Today&apos;s meals</h2>
          <p className="text-sm font-bold text-ink-soft">{todayLabel}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {MEAL_SLOTS.map((slot) => {
            const entry = todayBySlot.get(slot);
            const style = SLOT_STYLES[slot];

            // entry.recipe is null if the recipe isn't visible to this
            // user any more — nothing to link to, so it's shown as an
            // empty slot rather than a card with no title.
            if (entry?.recipe) {
              return (
                <Link
                  key={slot}
                  href={`/recipes/${entry.recipe.id}`}
                  className={`flex min-h-[104px] flex-col xl:min-h-[150px] rounded-[12px_15px_11px_14px] border-2 border-ink p-3 transition hover:-translate-y-0.5 hover:brightness-105 ${style.cell}`}
                >
                  <span className="font-display text-xs font-semibold uppercase tracking-wide text-ink">
                    {slot}
                  </span>
                  <span className="mt-1 line-clamp-2 font-display text-lg font-semibold leading-snug text-ink">
                    {entry.recipe.title}
                  </span>
                  <span className="mt-auto pt-1 text-xs font-bold text-ink">
                    {entry.servings} {entry.servings === 1 ? "serving" : "servings"}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={slot}
                href={`/planner?week=${todayISO}`}
                className="group flex min-h-[104px] flex-col xl:min-h-[150px] rounded-xl border-2 border-dashed border-ink-faint p-3 transition hover:border-ink hover:bg-cream-deep"
              >
                <span
                  className={`font-display text-xs font-semibold uppercase tracking-wide ${style.label}`}
                >
                  {slot}
                </span>
                <span className="mt-1 font-display text-lg font-semibold text-ink-soft transition group-hover:text-ink">
                  + Add meal
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* The planner's own "X of Y meals planned" count and progress
          bar, plus one column per day with a dot per meal slot (filled
          in that slot's color once something's planned) — the whole
          week's state at a glance, and one click from the planner. */}
      <Link
        href="/planner"
        className="wobble-b flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-2 border-ink bg-cream-card p-5 transition hover:bg-cream-deep"
      >
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-widest text-leaf-600">
            This week
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-ink">
            {filledSlots} of {totalSlots} meals planned
          </p>
          <div
            aria-hidden
            className="mt-2 h-2.5 w-52 overflow-hidden rounded-full border-2 border-ink bg-cream-card"
          >
            <div
              className="h-full rounded-full bg-leaf-400"
              style={{ width: `${Math.round((filledSlots / totalSlots) * 100)}%` }}
            />
          </div>
        </div>

        {/* aria-hidden: the dots only repeat, per day, what the sentence
            above already says in total. */}
        <div aria-hidden className="flex gap-2 sm:gap-3">
          {weekDays.map((day, i) => {
            const dateISO = toISODate(day);
            const isToday = dateISO === todayISO;
            return (
              <div
                key={dateISO}
                className={`flex flex-col items-center gap-1 ${dateISO < todayISO ? "opacity-50" : ""}`}
              >
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">
                  {DAY_LABELS[i]}
                </span>
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center font-display text-sm font-bold text-ink ${
                    isToday ? "rounded-full bg-citrus-400" : ""
                  }`}
                >
                  {day.getUTCDate()}
                </span>
                <span className="flex gap-0.5">
                  {MEAL_SLOTS.map((slot) => (
                    <span
                      key={slot}
                      className={`h-2 w-2 rounded-full border ${
                        plannedCells.has(`${dateISO}_${slot}`)
                          ? `border-ink ${SLOT_STYLES[slot].cell}`
                          : "border-ink-faint"
                      }`}
                    />
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </Link>
      </div>
      </div>

      {/* action cards */}
      <div className="grid gap-5 sm:grid-cols-3">
        <Link
          href="/recipes"
          className="wobble-a hand-shadow relative -rotate-1 bg-tomato-400 p-6 xl:p-8 transition duration-150 hover:z-10 hover:-translate-y-2 hover:scale-105 hover:rotate-0 hover:shadow-[8px_8px_0_oklch(24%_0.03_150)] hover:brightness-105 active:translate-y-0 active:scale-100"
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
          className="wobble-b hand-shadow relative rotate-1 bg-leaf-400 p-6 xl:p-8 transition duration-150 hover:z-10 hover:-translate-y-2 hover:scale-105 hover:rotate-0 hover:shadow-[8px_8px_0_oklch(24%_0.03_150)] hover:brightness-105 active:translate-y-0 active:scale-100"
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

        {/* Used to be an "Edit profile" card — the profile is one tap
            away in the nav bar on every page, while the shopping list is
            the third thing this app actually does and had no card here
            at all. Same bag icon as its nav tab (see site-nav.tsx). */}
        <Link
          href="/shopping-list"
          className="wobble-a hand-shadow relative -rotate-[0.6deg] bg-citrus-400 p-6 xl:p-8 transition duration-150 hover:z-10 hover:-translate-y-2 hover:scale-105 hover:rotate-0 hover:shadow-[8px_8px_0_oklch(24%_0.03_150)] hover:brightness-105 active:translate-y-0 active:scale-100"
        >
          <svg width="30" height="30" viewBox="0 0 34 34" className="mb-3">
            <path
              d="M8,11 L26,11 L24,29 L10,29 Z"
              fill="none"
              stroke="oklch(24% 0.03 150)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path
              d="M12,11 C12,6 14,4 17,4 C20,4 22,6 22,11"
              fill="none"
              stroke="oklch(24% 0.03 150)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <p className="font-display text-xl font-semibold text-ink">Shopping list</p>
          <p className="mt-1 text-sm text-ink-soft">
            {/* The count needs the list re-synced first (see
                ShoppingSummary above), which is by far the slowest thing
                on this page — so it streams in on its own once it's
                ready, instead of the whole dashboard waiting on it. */}
            <Suspense fallback="Checking this week's list…">
              <ShoppingSummary userId={user.id} weekStartISO={weekStartISO} />
            </Suspense>
          </p>
        </Link>
      </div>
    </main>
  );
}
