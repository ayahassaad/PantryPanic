import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MEAL_SLOTS, type MealSlot } from "@pantry-panic/shared";
import { addDays, getISOWeekNumber, resolveWeekStart, toISODate } from "@/lib/week";
import { Mascot } from "@/components/mascot";
import { PlannerCell } from "./planner-cell";
import { CopyWeekButton } from "./copy-week-button";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Rotates by day of week, same trick as the login page's tagline — no
// client-side randomness (which would risk a hydration mismatch on this
// server-rendered page), just a deterministic pick that changes daily.
const PLANNER_TIPS = [
  "Weekends still empty? No panic: the shopping list only pulls what's actually planned.",
  "Every recipe you plan is one less “what's for dinner” panic later.",
  "Tap a box, see the recipe. It's basically magic (it's not, it's just good UX).",
  "A plan a day keeps the takeout away.",
  "Changed your mind? Just pick a new recipe — it swaps right in.",
];

// One accent per meal slot, echoed from the design mockup (breakfast =
// citrus, lunch = leaf, dinner = tomato). citrus-400 is light enough that
// dark ink reads better on it than cream; leaf/tomato are dark enough to
// need cream text instead.
const SLOT_STYLES: Record<
  MealSlot,
  { label: string; cell: string; text: string }
> = {
  breakfast: { label: "text-citrus-600", cell: "bg-citrus-400", text: "text-ink" },
  lunch: { label: "text-leaf-600", cell: "bg-leaf-400", text: "text-cream" },
  dinner: { label: "text-tomato-600", cell: "bg-tomato-400", text: "text-cream" },
};

interface PlannerEntry {
  id: string;
  plan_date: string;
  meal_slot: MealSlot;
  servings: number;
  recipe: { id: string; title: string } | null;
}

interface RecipeOption {
  id: string;
  title: string;
}

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { week } = await searchParams;
  const weekStart = resolveWeekStart(week);
  const weekNumber = getISOWeekNumber(weekStart);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekStartISO = toISODate(weekStart);
  const weekEndISO = toISODate(addDays(weekStart, 6));
  const prevWeekISO = toISODate(addDays(weekStart, -7));
  const nextWeekISO = toISODate(addDays(weekStart, 7));
  const todayISO = toISODate(new Date());

  // recipe:recipes(id, title) embeds the joined recipe via the recipe_id
  // foreign key — PostgREST resolves the relationship automatically, no
  // manual join needed.
  const [{ data: entries }, { data: recipes }] = await Promise.all([
    supabase
      .from("meal_plan_entries")
      .select("id, plan_date, meal_slot, servings, recipe:recipes(id, title)")
      .eq("user_id", user.id)
      .gte("plan_date", weekStartISO)
      .lte("plan_date", weekEndISO)
      .returns<PlannerEntry[]>(),
    supabase
      .from("recipes")
      .select("id, title")
      .order("title")
      .returns<RecipeOption[]>(),
  ]);

  const entryByCell = new Map<string, PlannerEntry>();
  for (const entry of entries ?? []) {
    entryByCell.set(`${entry.plan_date}_${entry.meal_slot}`, entry);
  }

  const hasRecipes = Boolean(recipes && recipes.length > 0);
  const tip = PLANNER_TIPS[new Date().getDay() % PLANNER_TIPS.length] ?? PLANNER_TIPS[0];

  const totalSlots = weekDays.length * MEAL_SLOTS.length;
  const filledSlots = entries?.length ?? 0;

  const todayColumnIndex = weekDays.findIndex((d) => toISODate(d) === todayISO);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-8 sm:px-10">
      <Link
        href="/dashboard"
        className="mb-8 w-fit border-b-2 border-dashed border-ink-soft text-sm font-bold text-ink-soft transition hover:text-ink"
      >
        &larr; Dashboard
      </Link>

      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 font-display text-xs font-semibold uppercase tracking-widest text-tomato-400">
            Planner
          </p>
          <h1 className="-rotate-[0.4deg] font-display text-3xl font-bold text-ink sm:text-4xl">
            Week {weekNumber}
          </h1>
          <p className="mt-1 text-sm font-bold text-ink-soft">
            {filledSlots} of {totalSlots} meals planned
          </p>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2.5">
          <Link
            href={`/planner?week=${prevWeekISO}`}
            className="wobble-btn border-2 border-ink bg-cream-card px-4 py-2 font-display text-sm font-semibold text-ink transition hover:bg-cream-deep"
          >
            &larr; Prev
          </Link>
          <Link
            href={`/planner?week=${todayISO}`}
            className="wobble-btn border-2 border-ink bg-cream-card px-4 py-2 font-display text-sm font-semibold text-ink transition hover:bg-cream-deep"
          >
            Today
          </Link>
          <Link
            href={`/planner?week=${nextWeekISO}`}
            className="wobble-btn border-2 border-ink bg-cream-card px-4 py-2 font-display text-sm font-semibold text-ink transition hover:bg-cream-deep"
          >
            Next &rarr;
          </Link>
          <CopyWeekButton
            weekStartISO={weekStartISO}
            nextWeekISO={nextWeekISO}
            disabled={filledSlots === 0}
          />
          <Link
            href={`/shopping-list?week=${weekStartISO}`}
            className="wobble-btn hand-shadow bg-tomato-400 px-4 py-2 font-display text-sm font-semibold text-cream transition hover:brightness-105"
          >
            Shopping list
          </Link>
        </div>
      </div>

      {!hasRecipes && (
        <p className="wobble-btn mb-6 border-2 border-ink bg-citrus-50 px-4 py-3 text-sm font-bold text-ink">
          You don&apos;t have any recipes yet, so{" "}
          <Link href="/recipes/new" className="underline">
            add one
          </Link>{" "}
          or{" "}
          <Link href="/recipes/suggest" className="underline">
            ask AI for one
          </Link>{" "}
          before planning your week.
        </p>
      )}

      <div className="overflow-x-auto">
        <div className="relative grid min-w-[780px] grid-cols-[76px_repeat(7,1fr)] items-center gap-2.5">
          {/* A subtle tint behind today's whole column, so it's visible
              at a glance instead of just the small circle on its date
              number. Explicitly positioned (not part of the normal grid
              flow), so it paints behind every cell placed after it —
              colored/filled cells cover it completely, and the
              transparent empty "+ Add" cells and day header let it show
              through. */}
          {todayColumnIndex !== -1 && (
            <div
              aria-hidden
              className="pointer-events-none rounded-2xl bg-citrus-50"
              style={{ gridColumn: `${todayColumnIndex + 2} / span 1`, gridRow: "1 / -1" }}
            />
          )}

          <div />
          {weekDays.map((day, i) => {
            const isToday = toISODate(day) === todayISO;
            return (
              <div key={toISODate(day)} className="text-center">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
                  {DAY_LABELS[i]}
                </p>
                <p
                  className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center font-display text-sm font-bold text-ink ${
                    isToday ? "rounded-full bg-citrus-400" : ""
                  }`}
                >
                  {day.getUTCDate()}
                </p>
              </div>
            );
          })}

          {MEAL_SLOTS.flatMap((slot) => {
            const slotStyle = SLOT_STYLES[slot];

            return [
              <div
                key={`${slot}-label`}
                className={`flex items-center font-display text-xs font-semibold uppercase tracking-wide ${slotStyle.label}`}
              >
                {slot}
              </div>,
              ...weekDays.map((day) => {
                const dateISO = toISODate(day);
                const entry = entryByCell.get(`${dateISO}_${slot}`);

                return (
                  <PlannerCell
                    key={`${slot}-${dateISO}`}
                    dateISO={dateISO}
                    slot={slot}
                    initialEntry={
                      entry
                        ? {
                            id: entry.id,
                            recipeId: entry.recipe?.id ?? null,
                            recipeTitle: entry.recipe?.title ?? null,
                            servings: entry.servings,
                          }
                        : null
                    }
                    recipes={recipes ?? []}
                    hasRecipes={hasRecipes}
                    cellClass={slotStyle.cell}
                    textClass={slotStyle.text}
                  />
                );
              }),
            ];
          })}
        </div>
      </div>

      <div className="mt-8 flex max-w-xl items-center gap-4 rounded-2xl bg-cream-deep px-5 py-4">
        <Mascot className="h-[50px] w-[46px] flex-none" />
        <p className="text-sm font-bold text-ink">{tip}</p>
      </div>
    </main>
  );
}
