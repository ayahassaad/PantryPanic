import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MEAL_SLOTS, type MealSlot } from "@pantry-panic/shared";
import { addDays, getISOWeekNumber, resolveWeekStart, toISODate } from "@/lib/week";
import { Mascot } from "@/components/mascot";
import { DoodleCarrot, DoodleCitrusSlice, DoodleGrapes, DoodleLeafSprig } from "@/components/food-doodles";
import { PlannerCell, type PlannerEntryView, type RecipeOption } from "./planner-cell";
import { MobileWeekView, type MobileDay } from "./mobile-week-view";
import { CopyWeekButton } from "./copy-week-button";
import { RotatingTip } from "./rotating-tip";

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

// A few doodles that continuously drift down today's column — same
// falling idea as the recipe cards' hover animation (see
// card-doodle-fall in globals.css), just always running instead of
// hover-gated, and driving `top` in percent so it works at whatever
// height that column ends up being. Left offsets/delays/durations are
// hand-picked (not randomized) so it reads as "a few doodles, gently
// staggered" rather than needing a seeded-random helper for four values.
const TODAY_COLUMN_DOODLES: Array<{
  Shape: (props: { className?: string; style?: CSSProperties }) => JSX.Element;
  left: string;
  delay: string;
  duration: string;
  sizeClass: string;
}> = [
  { Shape: DoodleCarrot, left: "8%", delay: "0s", duration: "4.6s", sizeClass: "h-4 w-4" },
  { Shape: DoodleCitrusSlice, left: "68%", delay: "1.3s", duration: "5.2s", sizeClass: "h-4 w-4" },
  { Shape: DoodleLeafSprig, left: "36%", delay: "2.7s", duration: "4.1s", sizeClass: "h-3.5 w-3.5" },
  { Shape: DoodleGrapes, left: "84%", delay: "3.5s", duration: "5.5s", sizeClass: "h-4 w-4" },
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

// The raw shape the recipes query returns — everything RecipeOption has
// except isFavorite, which isn't a column and gets merged in below from a
// separate query against recipe_favorites.
interface RecipeOptionRow {
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
  const [{ data: entries }, { data: recipeRows }, { data: favoriteRows }] = await Promise.all([
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
      .returns<RecipeOptionRow[]>(),
    supabase.from("recipe_favorites").select("recipe_id").eq("owner_id", user.id),
  ]);

  // Favorited recipes are sorted to the front so they're the first thing
  // offered when assigning a meal — Array#sort is stable, so the
  // alphabetical order from the query above is preserved within each
  // group (favorites, then everything else).
  const favoritedIds = new Set((favoriteRows ?? []).map((row) => row.recipe_id as string));
  const recipes: RecipeOption[] = (recipeRows ?? [])
    .map((r) => ({ ...r, isFavorite: favoritedIds.has(r.id) }))
    .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));

  const entryByCell = new Map<string, PlannerEntry>();
  for (const entry of entries ?? []) {
    entryByCell.set(`${entry.plan_date}_${entry.meal_slot}`, entry);
  }

  function toEntryView(entry: PlannerEntry | undefined): PlannerEntryView | null {
    if (!entry) {
      return null;
    }
    return {
      id: entry.id,
      recipeId: entry.recipe?.id ?? null,
      recipeTitle: entry.recipe?.title ?? null,
      servings: entry.servings,
    };
  }

  const hasRecipes = Boolean(recipes && recipes.length > 0);
  // Which tip the rotation starts on — RotatingTip (a client component)
  // takes it from there and advances every 10s on its own timer. Tying
  // the starting point to the day of week is purely a nice touch (same
  // one visitor sees the same first tip all day); the actual rotation
  // needs a client-side interval, which is why this can no longer be a
  // single server-picked value the way it used to be.
  const tipStartIndex = new Date().getDay() % PLANNER_TIPS.length;

  const totalSlots = weekDays.length * MEAL_SLOTS.length;
  const filledSlots = entries?.length ?? 0;

  const todayColumnIndex = weekDays.findIndex((d) => toISODate(d) === todayISO);

  // Same per-day data as the desktop grid below, just reshaped into one
  // object per day (instead of one cell per grid position) for the
  // mobile day-switcher view.
  const mobileDays: MobileDay[] = weekDays.map((day, i) => {
    const dateISO = toISODate(day);
    return {
      dateISO,
      dayLabel: DAY_LABELS[i] ?? "",
      dayNumber: day.getUTCDate(),
      isToday: dateISO === todayISO,
      entries: Object.fromEntries(
        MEAL_SLOTS.map((slot) => [slot, toEntryView(entryByCell.get(`${dateISO}_${slot}`))]),
      ) as MobileDay["entries"],
    };
  });
  const mobileDefaultDateISO =
    mobileDays.find((d) => d.isToday)?.dateISO ?? mobileDays[0]?.dateISO ?? weekStartISO;

  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-6 py-8 sm:px-10">
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

      {/* 780px+ side-by-side week grid — hidden below md, where
          MobileWeekView below takes over with a one-day-at-a-time layout
          instead of forcing horizontal scrolling. */}
      <div className="hidden overflow-x-auto md:block">
        <div className="relative grid min-w-[780px] grid-cols-[76px_repeat(7,1fr)] items-center gap-2.5">
          {/* Today's whole column gets a few doodles continuously
              falling down it, so it's visible at a glance instead of
              just the small circle on its date number.

              This MUST be `absolute` (not a plain grid item): a grid
              item placed with `gridColumn`/`gridRow` — even one with no
              visible content — still occupies those cells for the
              auto-placement algorithm, which skips any cell already
              taken (by an explicit item or otherwise) when placing the
              next auto-positioned item. Spanning every row of today's
              column with a normal grid item bumped every subsequent
              auto-placed cell in that column sideways into whatever
              slot was next free, cascading into every row below it —
              that's the "everything's shifted one column, Sunday's
              header lands in the label column" bug this replaced.
              `absolute` takes it out of grid-item generation entirely
              (it's just sized/positioned against the grid lines named
              in `style`, via the `relative` grid container above as its
              containing block), so it can align to today's column
              without ever competing for a cell. */}
          {todayColumnIndex !== -1 && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
              style={{ gridColumn: `${todayColumnIndex + 2} / span 1`, gridRow: "1 / -1" }}
            >
              {TODAY_COLUMN_DOODLES.map(({ Shape, left, delay, duration, sizeClass }, i) => (
                <Shape
                  key={i}
                  className={`today-doodle-fall absolute top-0 ${sizeClass}`}
                  style={{ left, animationDelay: delay, animationDuration: duration }}
                />
              ))}
            </div>
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

                return (
                  <PlannerCell
                    key={`${slot}-${dateISO}`}
                    dateISO={dateISO}
                    slot={slot}
                    initialEntry={toEntryView(entryByCell.get(`${dateISO}_${slot}`))}
                    recipes={recipes}
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

      <MobileWeekView
        days={mobileDays}
        recipes={recipes}
        hasRecipes={hasRecipes}
        slotOrder={MEAL_SLOTS}
        slotStyles={SLOT_STYLES}
        defaultDateISO={mobileDefaultDateISO}
      />

      <div className="mt-8 flex max-w-xl items-center gap-4 rounded-2xl bg-cream-deep px-5 py-4">
        <Mascot className="h-[50px] w-[46px] flex-none" />
        <RotatingTip tips={PLANNER_TIPS} startIndex={tipStartIndex} />
      </div>
    </main>
  );
}
