import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  INGREDIENT_CATEGORIES,
  INGREDIENT_CATEGORY_LABELS,
  type IngredientCategory,
} from "@pantry-panic/shared";
import { addDays, resolveWeekStart, toISODate } from "@/lib/week";
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

function formatAmount(item: { quantity: number | null; unit: string | null }): string | null {
  if (item.quantity == null) {
    return item.unit ?? null;
  }
  // recipe_ingredients.quantity is numeric, which can come back as e.g.
  // 2.5 or 2 — round display to 2 decimal places so "2 cups" never shows
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
  // at the database level — but older ingredients predating that
  // constraint can still have category = null, which lands in "other").
  const orderedCategories: string[] = [
    ...INGREDIENT_CATEGORIES.filter((category) => itemsByCategory.has(category)),
    ...[...itemsByCategory.keys()].filter(
      (category) => !(INGREDIENT_CATEGORIES as readonly string[]).includes(category),
    ),
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-16">
      <Link
        href={`/planner?week=${weekStartISO}`}
        className="mb-8 w-fit text-sm text-neutral-500 underline underline-offset-2"
      >
        &larr; Back to planner
      </Link>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-basil-600">
            Shopping list
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-basil-700">
            Week of{" "}
            {weekStart.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            })}
          </h1>
        </div>
        <div className="flex flex-none gap-2">
          <Link
            href={`/shopping-list?week=${prevWeekISO}`}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-100"
          >
            &larr; Prev
          </Link>
          <Link
            href={`/shopping-list?week=${nextWeekISO}`}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-100"
          >
            Next &rarr;
          </Link>
        </div>
      </div>

      <form action={generateShoppingList} className="mb-6 flex flex-wrap items-center gap-3">
        <input type="hidden" name="weekStartDate" value={weekStartISO} />
        <button
          type="submit"
          className="w-fit rounded-md bg-basil-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-basil-700"
        >
          {list ? "Regenerate from planner" : "Generate from planner"}
        </button>
        <span className="text-xs text-neutral-500">
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
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-base outline-none focus:border-basil-600"
          />
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            Add
          </button>
        </form>
      )}

      {!list && (
        <p className="text-neutral-600">
          No shopping list yet for this week. Generate one above once
          you&apos;ve{" "}
          <Link href={`/planner?week=${weekStartISO}`} className="underline">
            planned some meals
          </Link>
          .
        </p>
      )}

      {list && (!items || items.length === 0) && (
        <p className="text-neutral-600">
          Nothing here yet. Plan some meals for this week and regenerate,
          or add your own items above.
        </p>
      )}

      <div className="flex flex-col gap-6">
        {orderedCategories.map((category) => (
          <section key={category}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {INGREDIENT_CATEGORY_LABELS[category as IngredientCategory] ?? category}
            </h2>
            <ul className="flex flex-col gap-1.5">
              {itemsByCategory.get(category)?.map((item) => {
                const amount = formatAmount(item);
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-md border border-neutral-200 px-3 py-2"
                  >
                    <CheckToggleForm
                      itemId={item.id}
                      isChecked={item.is_checked}
                      label={item.name}
                    />
                    <span
                      className={`flex-1 text-sm ${
                        item.is_checked ? "text-neutral-400 line-through" : "text-neutral-800"
                      }`}
                    >
                      {[amount, item.name].filter(Boolean).join(" ")}
                      {item.is_manual && (
                        <span className="ml-2 text-xs text-neutral-400">(added by you)</span>
                      )}
                    </span>
                    <form action={removeItem}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <button
                        type="submit"
                        className="text-xs text-neutral-400 underline hover:text-neutral-600"
                      >
                        Remove
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
