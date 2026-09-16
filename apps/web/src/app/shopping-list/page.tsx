import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  INGREDIENT_CATEGORIES,
  INGREDIENT_CATEGORY_LABELS,
  type IngredientCategory,
} from "@pantry-panic/shared";
import { addDays, resolveWeekStart, toISODate } from "@/lib/week";
import { Mascot } from "@/components/mascot";
import { addManualItem, generateShoppingList, removeItem } from "./actions";
import { CheckToggleForm } from "./check-toggle-form";

interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  is_checked: boolean;
  is_manual: boolean;
}

// One icon + accent per aisle, echoed from the design mockup. Keyed by
// plain string (not IngredientCategory) since a handful of older rows can
// still carry a category value from before it was constrained at the
// database level — CATEGORY_STYLES[category] falls back to the generic
// cart style for any of those, same spirit as INGREDIENT_CATEGORY_LABELS'
// own `?? category` fallback below.
const CATEGORY_STYLES: Record<string, { icon: string; color: string }> = {
  produce: { icon: "\u{1F96C}", color: "text-leaf-600" },
  "meat-seafood": { icon: "\u{1F357}", color: "text-tomato-600" },
  "dairy-eggs": { icon: "\u{1F95A}", color: "text-blueberry-600" },
  bakery: { icon: "\u{1F35E}", color: "text-carrot-600" },
  pantry: { icon: "\u{1F96B}", color: "text-citrus-600" },
  frozen: { icon: "\u{1F9CA}", color: "text-blueberry-400" },
  "spices-condiments": { icon: "\u{1F9C2}", color: "text-carrot-400" },
  beverages: { icon: "\u{1F964}", color: "text-leaf-400" },
  other: { icon: "\u{1F6D2}", color: "text-ink-soft" },
};
const DEFAULT_CATEGORY_STYLE = { icon: "\u{1F6D2}", color: "text-ink-soft" };

function formatAmount(item: { quantity: number | null; unit: string | null }): string | null {
  if (item.quantity == null) {
    return item.unit ?? null;
  }
  // recipe_ingredients.quantity is numeric, which can come back as e.g.
  // 2.5 or 2. Round display to 2 decimal places so "2 cups" never shows
  // up as "2.0000000001 cups" from repeated float addition.
  const rounded = Math.round(item.quantity * 100) / 100;
  return [rounded, item.unit].filter(Boolean).join(" ");
}

export default async function ShoppingListPage({
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
  const weekStartISO = toISODate(weekStart);
  const prevWeekISO = toISODate(addDays(weekStart, -7));
  const nextWeekISO = toISODate(addDays(weekStart, 7));

  const { data: list } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("user_id", user.id)
    .eq("week_start_date", weekStartISO)
    .maybeSingle();

  const { data: items } = list
    ? await supabase
        .from("shopping_list_items")
        .select("id, name, quantity, unit, category, is_checked, is_manual")
        .eq("shopping_list_id", list.id)
        .order("category")
        .order("name")
        .returns<ShoppingListItem[]>()
    : { data: null };

  const itemsByCategory = new Map<string, ShoppingListItem[]>();
  for (const item of items ?? []) {
    const category = item.category ?? "other";
    const bucket = itemsByCategory.get(category) ?? [];
    bucket.push(item);
    itemsByCategory.set(category, bucket);
  }

  // Known aisles first in a sensible shopping order, then anything else
  // (there shouldn't be anything else, since category is now constrained
  // at the database level, but older ingredients predating that
  // constraint can still have category = null, which lands in "other").
  const orderedCategories: string[] = [
    ...INGREDIENT_CATEGORIES.filter((category) => itemsByCategory.has(category)),
    ...[...itemsByCategory.keys()].filter(
      (category) => !(INGREDIENT_CATEGORIES as readonly string[]).includes(category),
    ),
  ];

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-8 sm:px-10">
      <Link
        href={`/planner?week=${weekStartISO}`}
        className="mb-8 w-fit border-b-2 border-dashed border-ink-soft text-sm font-bold text-ink-soft transition hover:text-ink"
      >
        &larr; Planner
      </Link>

      <div className="mb-6 flex items-center gap-4">
        <Mascot className="h-[60px] w-[54px] flex-none" />
        <div>
          <p className="mb-1 font-display text-xs font-semibold uppercase tracking-widest text-tomato-400">
            Shopping list
          </p>
          <h1 className="-rotate-[0.4deg] font-display text-2xl font-bold text-ink sm:text-3xl">
            Week of{" "}
            {weekStart.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            })}
          </h1>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2.5">
        <Link
          href={`/shopping-list?week=${prevWeekISO}`}
          className="wobble-btn border-2 border-ink bg-cream-card px-4 py-2 font-display text-sm font-semibold text-ink transition hover:bg-cream-deep"
        >
          &larr; Prev
        </Link>
        <Link
          href={`/shopping-list?week=${nextWeekISO}`}
          className="wobble-btn border-2 border-ink bg-cream-card px-4 py-2 font-display text-sm font-semibold text-ink transition hover:bg-cream-deep"
        >
          Next &rarr;
        </Link>
      </div>

      <form action={generateShoppingList} className="mb-6 flex flex-wrap items-center gap-3">
        <input type="hidden" name="weekStartDate" value={weekStartISO} />
        <button
          type="submit"
          className="wobble-btn hand-shadow bg-tomato-400 px-5 py-2.5 font-display text-sm font-semibold text-cream transition hover:brightness-105"
        >
          {list ? "Regenerate from planner" : "Generate from planner"}
        </button>
        <span className="text-xs text-ink-soft">
          Pulls ingredients from everything planned for this week.
          {list ? " Already-checked items stay checked." : ""}
        </span>
      </form>

      {list && (
        <form action={addManualItem} className="mb-8 flex gap-2">
          <input type="hidden" name="shoppingListId" value={list.id} />
          <input
            type="text"
            name="name"
            placeholder="Add your own item"
            required
            className="flex-1 rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none placeholder:text-ink-faint focus:border-tomato-400"
          />
          <button
            type="submit"
            className="rounded-xl border-2 border-ink bg-cream-deep px-4 py-2.5 font-display text-sm font-semibold text-ink transition hover:bg-cream"
          >
            Add
          </button>
        </form>
      )}

      {!list && (
        <p className="wobble-btn mb-6 border-2 border-ink bg-citrus-50 px-4 py-3 text-sm font-bold text-ink">
          No shopping list yet for this week. Generate one above once
          you&apos;ve{" "}
          <Link href={`/planner?week=${weekStartISO}`} className="underline">
            planned some meals
          </Link>
          .
        </p>
      )}

      {list && (!items || items.length === 0) && (
        <p className="wobble-btn mb-6 border-2 border-ink bg-citrus-50 px-4 py-3 text-sm font-bold text-ink">
          Nothing here yet. Plan some meals for this week and regenerate,
          or add your own items above.
        </p>
      )}

      <div className="flex flex-col gap-7">
        {orderedCategories.map((category) => {
          const style = CATEGORY_STYLES[category] ?? DEFAULT_CATEGORY_STYLE;

          return (
            <section key={category}>
              <p
                className={`mb-2.5 font-display text-xs font-semibold uppercase tracking-widest ${style.color}`}
              >
                {style.icon}{" "}
                {INGREDIENT_CATEGORY_LABELS[category as IngredientCategory] ?? category}
              </p>
              <ul className="flex flex-col gap-2">
                {itemsByCategory.get(category)?.map((item) => {
                  const amount = formatAmount(item);
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border-2 border-ink bg-cream-card px-3.5 py-2.5"
                    >
                      <CheckToggleForm
                        itemId={item.id}
                        isChecked={item.is_checked}
                        label={item.name}
                      />
                      <span
                        className={`flex-1 text-sm font-bold ${
                          item.is_checked ? "text-ink-faint line-through" : "text-ink"
                        }`}
                      >
                        {[amount, item.name].filter(Boolean).join(" ")}
                        {item.is_manual && (
                          <span className="ml-2 rounded-full bg-cream-deep px-2 py-0.5 text-[11px] font-extrabold text-ink-soft">
                            added by you
                          </span>
                        )}
                      </span>
                      <form action={removeItem}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <button
                          type="submit"
                          className="text-xs font-bold text-ink-faint underline hover:text-ink-soft"
                        >
                          Remove
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
