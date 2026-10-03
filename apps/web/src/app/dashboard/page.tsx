import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MEAL_SLOTS, type MealSlot } from "@pantry-panic/shared";
import { addDays, resolveWeekStart, toISODate } from "@/lib/week";
import { Mascot } from "@/components/mascot";
import { syncShoppingListFromPlanner } from "@/app/shopping-list/actions";
import { RecipeFoodMascot } from "@/app/recipes/[id]/recipe-food-mascot";
import { ShoppingNotepadList, type NotepadItem } from "./shopping-notepad-list";

// Same accent per meal slot as the planner grid (breakfast = citrus,
// lunch = leaf, dinner = tomato), so a meal's dot here matches its cell
// on the page it was planned on.
const SLOT_DOT: Record<MealSlot, string> = {
  breakfast: "bg-citrus-400",
  lunch: "bg-leaf-400",
  dinner: "bg-tomato-400",
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Purely decorative alphabet magnets in the freezer drawer. Each one's
// resting tilt lives on an outer wrapper and its jiggle (.magnet-shake in
// globals.css) on the letter itself, because both are CSS transforms — on
// one element the animation would simply replace the tilt. The delays
// are staggered so the shake ripples Y → U → M → ! instead of all four
// twitching at once.
const LETTER_MAGNETS = [
  { letter: "Y", color: "bg-tomato-400", tilt: "-rotate-[8deg]", delay: "0s" },
  { letter: "U", color: "bg-leaf-400", tilt: "rotate-[5deg] translate-y-1", delay: "0.12s" },
  { letter: "M", color: "bg-blueberry-400", tilt: "-rotate-[3deg] -translate-y-0.5", delay: "0.24s" },
  { letter: "!", color: "bg-carrot-400", tilt: "rotate-[9deg] translate-y-0.5", delay: "0.36s" },
];

// The round magnet "pinning" each piece of paper to the door.
const PIN_CLASSES =
  "absolute -top-3 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full border-[2.5px] border-ink shadow-[1px_2px_0_rgb(0_0_0/0.2)]";

// The pill-shaped magnet that works as a button ("Suggest tonight's
// dinner", in the freezer drawer).
const MAGNET_BUTTON_CLASSES =
  "whitespace-nowrap rounded-full border-[2.5px] border-ink px-5 py-2.5 font-display text-base font-semibold shadow-[3px_4px_0_rgb(0_0_0/0.2)] transition hover:-translate-y-0.5 hover:brightness-105";

interface PlanEntry {
  id: string;
  plan_date: string;
  meal_slot: MealSlot;
  servings: number;
  recipe: { id: string; title: string; description: string | null; image_url: string | null } | null;
}

interface ShoppingItemRow {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  is_checked: boolean;
}

// Same display rounding as the shopping list page: 2 decimal places, so
// "2 cups" never shows up as "2.0000000001 cups".
function formatAmount(item: { quantity: number | null; unit: string | null }): string | null {
  if (item.quantity == null) {
    return item.unit ?? null;
  }
  const rounded = Math.round(item.quantity * 100) / 100;
  return [rounded, item.unit].filter(Boolean).join(" ");
}

// What's written on the shopping notepad: this week's shopping list,
// every item of it, tickable right there on the fridge (the ticking
// itself is ShoppingNotepadList, a client component). The list is only ever
// rebuilt from the planner when something asks it to (see
// syncShoppingListFromPlanner), so it's synced here first, exactly as
// the shopping list page does on every visit — otherwise a meal added
// since that page was last opened wouldn't be counted, and this notepad
// would show a list the real one then contradicts. Same table, same
// rows, same order (category, then name) as that page, so the two are
// always two views of one list.
//
// Its own async component (rendered inside a <Suspense>) rather than
// part of DashboardPage's own data loading: that sync is several
// database round trips, and nothing else on the page needs its result.
async function ShoppingNotepad({ userId, weekStartISO }: { userId: string; weekStartISO: string }) {
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
        .select("id, name, quantity, unit, is_checked")
        .eq("shopping_list_id", list.id)
        .order("category")
        .order("name")
        .returns<ShoppingItemRow[]>()
    : { data: null };

  const notepadItems: NotepadItem[] = (items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    amount: formatAmount(item),
    isChecked: item.is_checked,
  }));

  return <ShoppingNotepadList items={notepadItems} />;
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
  // planner), not just today — today's sticky note and the week's row
  // of magnets are both read out of this one query.
  const weekStart = resolveWeekStart(undefined);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekStartISO = toISODate(weekStart);

  const { data: weekEntries } = await supabase
    .from("meal_plan_entries")
    .select("id, plan_date, meal_slot, servings, recipe:recipes(id, title, description, image_url)")
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

  // The meal on the pinned photo: tonight's dinner if there is one,
  // otherwise whatever else is planned today, latest meal first.
  const featuredSlot = (["dinner", "lunch", "breakfast"] as const).find(
    (slot) => todayBySlot.get(slot)?.recipe,
  );
  const featured = featuredSlot ? (todayBySlot.get(featuredSlot)?.recipe ?? null) : null;

  // Only needed when the photo falls back to a food character (no
  // uploaded picture): the character is guessed from the recipe's
  // ingredients, same as on its recipe card.
  const { data: featuredIngredients } =
    featured && !featured.image_url
      ? await supabase
          .from("recipe_ingredients")
          .select("name")
          .eq("recipe_id", featured.id)
          .returns<Array<{ name: string }>>()
      : { data: null };

  return (
    // The home page is a fridge door. It takes (almost) the whole window —
    // no max-width, just a little breathing room at the edges — and at
    // least the full height under the nav bar: a freezer drawer across
    // the top holding the greeting, and the main door below it with
    // everything "stuck" to it — today's meals on a sticky note, a
    // pinned photo of tonight's dinner, the shopping list on a notepad,
    // and the week as a row of magnets. (No buttons to the other pages:
    // the nav bar is right there on every screen size.) See the
    // .fridge-* / .notepad-lines classes in globals.css
    // for the few bits Tailwind's own scales don't cover.
    <main className="flex min-h-[calc(100dvh-4.5rem)] w-full flex-col px-3 py-4 sm:px-6 sm:py-5">
      <div className="hand-shadow flex flex-1 flex-col overflow-hidden rounded-[28px] border-[3px] border-ink sm:rounded-[34px]">
        {/* freezer drawer */}
        <div className="fridge-freezer relative flex flex-wrap items-center gap-x-7 gap-y-4 border-b-[3px] border-ink px-5 py-5 md:pl-10 md:pr-24">
          <div className="flex h-[84px] w-[84px] flex-none -rotate-[5deg] items-center justify-center rounded-full border-[3px] border-ink bg-cream-card shadow-[4px_5px_0_rgb(0_0_0/0.2)] md:h-[118px] md:w-[118px]">
            <Mascot className="h-16 w-14 md:h-[89px] md:w-[78px]" />
          </div>
          <div className="min-w-0 flex-1 basis-64">
            <h1 className="origin-left -rotate-1 font-display text-3xl font-bold leading-[1.05] text-ink md:text-5xl 2xl:text-[54px]">
              Hey {firstName}, what&apos;s cooking?
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] font-bold text-ink-soft md:text-lg">{heroLine}</p>
          </div>
          <div className="flex items-center gap-5 md:ml-auto">
            <div aria-hidden className="group hidden gap-1.5 xl:flex">
              {LETTER_MAGNETS.map(({ letter, color, tilt, delay }) => (
                <span key={letter} className={`block ${tilt}`}>
                  <span
                    className={`magnet-shake flex h-11 w-[38px] items-center justify-center rounded-[9px] border-[2.5px] border-ink font-display text-[26px] font-bold text-cream shadow-[2px_3px_0_rgb(0_0_0/0.2)] ${color}`}
                    style={{ animationDelay: delay }}
                  >
                    {letter}
                  </span>
                </span>
              ))}
            </div>
            {/* Only while tonight's dinner slot is still empty — a shortcut
                into the existing "Ask AI" form with Dinner already picked
                (see the `meal` param in recipes/suggest/page.tsx). */}
            {!todayBySlot.has("dinner") && (
              <Link
                href="/recipes/suggest?meal=dinner"
                className={`${MAGNET_BUTTON_CLASSES} bg-citrus-400 text-ink`}
              >
                &#10022; Suggest tonight&apos;s dinner
              </Link>
            )}
          </div>
          <span aria-hidden className="fridge-handle absolute right-7 top-1/2 hidden h-[74px] -translate-y-1/2 md:block" />
        </div>

        {/* main door */}
        <div className="fridge-door relative flex flex-1 flex-col gap-8 px-5 pb-6 pt-9 md:pb-8 md:pl-10 md:pr-24">
          <span aria-hidden className="fridge-handle absolute right-7 top-9 hidden h-52 md:block" />

          <div className="grid flex-1 items-start gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-[1.25fr_0.85fr_1fr] xl:gap-x-14">
            {/* Sticky note: today's three meals straight from the planner.
                A planned meal links to its recipe; an empty slot links to
                this week's planner to fill it. */}
            <section className="paper-shadow relative -rotate-2 border-[2.5px] border-ink bg-citrus-400 px-6 pb-6 pt-7 sm:px-7">
              <span aria-hidden className={`${PIN_CLASSES} bg-tomato-400`} />
              <h2 className="mb-3 flex items-baseline justify-between gap-3 font-display text-2xl font-bold leading-none text-ink xl:text-3xl">
                Today
                <small className="font-sans text-[13px] font-extrabold text-ink-soft">{todayLabel}</small>
              </h2>
              <ul>
                {MEAL_SLOTS.map((slot) => {
                  const entry = todayBySlot.get(slot);
                  return (
                    <li
                      key={slot}
                      className="border-b-2 border-dashed border-ink/25 py-2.5 last:border-b-0 last:pb-0"
                    >
                      <span className="mb-0.5 block text-[11px] font-extrabold uppercase tracking-wider text-ink/70">
                        {slot}
                      </span>
                      {/* entry.recipe is null if the recipe isn't visible
                          to this user any more — nothing to link to, so
                          it's shown as an empty slot. */}
                      {entry?.recipe ? (
                        <Link
                          href={`/recipes/${entry.recipe.id}`}
                          className="flex items-baseline justify-between gap-3 font-display text-xl leading-tight text-ink hover:underline xl:text-2xl"
                        >
                          <span className="line-clamp-2">{entry.recipe.title}</span>
                          <span className="flex-none font-sans text-xs font-extrabold text-ink/70">
                            {entry.servings} {entry.servings === 1 ? "serving" : "servings"}
                          </span>
                        </Link>
                      ) : (
                        <Link
                          href={`/planner?week=${todayISO}`}
                          className="border-b-2 border-dashed border-ink font-display text-xl leading-tight text-ink/70 transition hover:text-ink xl:text-2xl"
                        >
                          + add something
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Pinned photo: tonight's dinner (or, failing that, whatever
                else is planned today) — its uploaded picture if it has
                one, otherwise the same food character its recipe card
                shows. With nothing planned at all it's the mascot and a
                nudge toward the planner. */}
            <Link
              href={featured ? `/recipes/${featured.id}` : `/planner?week=${todayISO}`}
              className="paper-shadow relative mx-auto block w-full max-w-sm rotate-3 border-[2.5px] border-ink bg-cream-card px-4 pb-3 pt-4 text-center transition hover:rotate-1"
            >
              <span aria-hidden className={`${PIN_CLASSES} bg-leaf-400`} />
              {featured?.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- a
                // handful of user-uploaded images doesn't need next/image's
                // optimization pipeline (which also needs a configured
                // remote pattern for the Supabase Storage host).
                <img
                  src={featured.image_url}
                  alt=""
                  className="aspect-[4/3] w-full border-[2.5px] border-ink object-cover"
                />
              ) : (
                <div
                  className={`flex aspect-[4/3] items-center justify-center border-[2.5px] border-ink ${
                    featured ? "bg-tomato-400" : "bg-cream-deep"
                  }`}
                >
                  {featured ? (
                    <RecipeFoodMascot
                      title={featured.title}
                      description={featured.description}
                      ingredientNames={(featuredIngredients ?? []).map((ingredient) => ingredient.name)}
                      className="h-32 w-28 xl:h-40 xl:w-[140px]"
                    />
                  ) : (
                    <Mascot className="h-28 w-24" />
                  )}
                </div>
              )}
              <p className="mt-2.5 line-clamp-2 font-display text-lg leading-tight text-ink xl:text-[22px]">
                {featured ? featured.title : "Nothing planned yet"}
              </p>
              <small className="text-xs font-extrabold text-ink-soft">
                {featured
                  ? featuredSlot === "dinner"
                    ? "tonight's dinner"
                    : `today's ${featuredSlot}`
                  : "pick something in the planner"}
              </small>
            </Link>

            {/* Notepad: this week's shopping list, tickable in place — see
                ShoppingNotepad above. Not a link as a whole any more
                (it has checkboxes in it now); its heading and the line
                at the bottom open the full list. */}
            <div className="paper-shadow relative rotate-[1.5deg] border-[2.5px] border-ink bg-cream-card px-6 pb-5 pt-8 md:col-span-2 md:max-w-md xl:col-span-1 xl:max-w-none">
              <span aria-hidden className="absolute inset-x-0 top-0 h-3.5 border-b-[2.5px] border-ink bg-tomato-400" />
              <span aria-hidden className={`${PIN_CLASSES} bg-blueberry-400`} />
              <Suspense
                fallback={
                  <>
                    <h2 className="mb-3 font-display text-[28px] font-bold leading-none text-ink">
                      Shopping
                    </h2>
                    <p className="py-2 text-sm font-bold text-ink-soft">
                      Checking this week&apos;s list…
                    </p>
                  </>
                }
              >
                <ShoppingNotepad userId={user.id} weekStartISO={weekStartISO} />
              </Suspense>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-6">
            {/* The week as a row of day magnets: the planner's own "X of
                Y planned" count and progress bar, then one magnet per day
                with a dot per meal slot (filled in that slot's colour
                once something's planned). One click from the planner. */}
            <Link
              href="/planner"
              className="relative flex w-full -rotate-[0.6deg] flex-col gap-4 rounded-2xl border-[2.5px] border-ink bg-cream-card px-5 py-3.5 shadow-[4px_5px_0_rgb(0_0_0/0.18)] transition hover:rotate-0 sm:w-auto sm:flex-row sm:items-center"
            >
              <span aria-hidden className={`${PIN_CLASSES} bg-carrot-400`} />
              <div className="font-display text-lg font-bold leading-tight text-ink">
                <small className="block font-sans text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">
                  This week
                </small>
                {filledSlots} of {totalSlots} planned
                <div
                  aria-hidden
                  className="mt-1.5 h-2.5 w-[120px] overflow-hidden rounded-full border-2 border-ink bg-cream-card"
                >
                  <div
                    className="h-full bg-leaf-400"
                    style={{ width: `${Math.round((filledSlots / totalSlots) * 100)}%` }}
                  />
                </div>
              </div>
              {/* aria-hidden: the dots only repeat, per day, what the
                  count above already says in total. */}
              <div aria-hidden className="flex gap-1 sm:gap-2">
                {weekDays.map((day, i) => {
                  const dateISO = toISODate(day);
                  const isToday = dateISO === todayISO;
                  return (
                    <div
                      key={dateISO}
                      className={`flex h-[70px] flex-1 flex-col items-center justify-center gap-1 rounded-xl border-[2.5px] border-ink sm:h-[66px] sm:w-[58px] sm:flex-none sm:gap-0.5 sm:rounded-[15px] ${
                        isToday
                          ? "-rotate-[4deg] bg-citrus-400 shadow-[2px_3px_0_rgb(0_0_0/0.2)] sm:scale-110"
                          : `bg-cream ${dateISO < todayISO ? "opacity-50" : ""}`
                      }`}
                    >
                      <span className="text-[10px] font-extrabold uppercase leading-none text-ink-soft">
                        {DAY_LABELS[i]}
                      </span>
                      <span className="font-display text-lg font-bold leading-none text-ink">
                        {day.getUTCDate()}
                      </span>
                      <span className="flex gap-0.5">
                        {MEAL_SLOTS.map((slot) => (
                          <span
                            key={slot}
                            className={`h-2 w-2 rounded-full border ${
                              plannedCells.has(`${dateISO}_${slot}`)
                                ? `border-ink ${SLOT_DOT[slot]}`
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
      </div>
    </main>
  );
}
