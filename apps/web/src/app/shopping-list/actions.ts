"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addDays, toISODate } from "@/lib/week";
import { createClient } from "@/lib/supabase/server";

interface IngredientRow {
  recipe_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
}

const GenerateSchema = z.object({
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// (Re)builds this week's shopping list from whatever's in the planner:
// one row per recipe assigned that week, scaled by its servings count,
// merged with everything else already on the list by (name, unit) so the
// same ingredient from two different recipes becomes one line.
export async function generateShoppingList(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const parsed = GenerateSchema.safeParse({
    weekStartDate: formData.get("weekStartDate"),
  });
  if (!parsed.success) {
    return;
  }
  const { weekStartDate } = parsed.data;
  const weekEndISO = toISODate(addDays(new Date(`${weekStartDate}T00:00:00Z`), 6));

  // Get or create this week's list.
  const { data: list, error: listError } = await supabase
    .from("shopping_lists")
    .upsert(
      { user_id: user.id, week_start_date: weekStartDate },
      { onConflict: "user_id,week_start_date" },
    )
    .select("id")
    .single();

  if (listError || !list) {
    return;
  }

  const { data: entries } = await supabase
    .from("meal_plan_entries")
    .select("recipe_id, servings")
    .eq("user_id", user.id)
    .gte("plan_date", weekStartDate)
    .lte("plan_date", weekEndISO);

  // servings is treated as a straight multiplier on the recipe's
  // ingredient quantities — recipes don't record a "serves N" baseline,
  // so "servings: 2" means "twice the recipe as written," not "half of a
  // 4-serving recipe."
  const servingsByRecipe = new Map<string, number>();
  for (const entry of entries ?? []) {
    servingsByRecipe.set(
      entry.recipe_id,
      (servingsByRecipe.get(entry.recipe_id) ?? 0) + entry.servings,
    );
  }
  const recipeIds = [...servingsByRecipe.keys()];

  const { data: ingredientRows } =
    recipeIds.length > 0
      ? await supabase
          .from("recipe_ingredients")
          .select("recipe_id, name, quantity, unit, category")
          .in("recipe_id", recipeIds)
          .returns<IngredientRow[]>()
      : { data: [] as IngredientRow[] };

  interface Aggregate {
    name: string;
    unit: string | null;
    category: string | null;
    quantity: number | null;
  }
  const aggregated = new Map<string, Aggregate>();
  for (const ingredient of ingredientRows ?? []) {
    const multiplier = servingsByRecipe.get(ingredient.recipe_id) ?? 1;
    const unitKey = (ingredient.unit ?? "").trim().toLowerCase();
    const key = `${ingredient.name.trim().toLowerCase()}__${unitKey}`;
    const scaledQuantity = ingredient.quantity != null ? ingredient.quantity * multiplier : null;

    const existing = aggregated.get(key);
    if (existing) {
      // Only sum when both sides actually have an amount — once either
      // one doesn't, the combined line can't honestly show a total, so
      // it falls back to "just list it" (quantity: null) instead of
      // silently dropping part of the amount.
      existing.quantity =
        existing.quantity != null && scaledQuantity != null
          ? existing.quantity + scaledQuantity
          : null;
    } else {
      aggregated.set(key, {
        name: ingredient.name,
        unit: ingredient.unit,
        category: ingredient.category,
        quantity: scaledQuantity,
      });
    }
  }

  // Regenerating shouldn't reset progress on a list someone's already
  // partway through shopping — carry over is_checked for any item whose
  // (name, unit) still matches after the rebuild.
  const { data: previousItems } = await supabase
    .from("shopping_list_items")
    .select("name, unit, is_checked")
    .eq("shopping_list_id", list.id)
    .eq("is_manual", false);

  const checkedByKey = new Map<string, boolean>();
  for (const item of previousItems ?? []) {
    const key = `${item.name.trim().toLowerCase()}__${(item.unit ?? "").trim().toLowerCase()}`;
    checkedByKey.set(key, item.is_checked);
  }

  // Manually-added items (is_manual: true) are left alone entirely —
  // only the auto-generated ones get replaced.
  await supabase
    .from("shopping_list_items")
    .delete()
    .eq("shopping_list_id", list.id)
    .eq("is_manual", false);

  const newItems = [...aggregated.entries()].map(([key, item], index) => ({
    shopping_list_id: list.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    is_checked: checkedByKey.get(key) ?? false,
    is_manual: false,
    sort_order: index,
  }));

  if (newItems.length > 0) {
    await supabase.from("shopping_list_items").insert(newItems);
  }

  revalidatePath("/shopping-list");
}

const AddItemSchema = z.object({
  shoppingListId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
});

export async function addManualItem(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const parsed = AddItemSchema.safeParse({
    shoppingListId: formData.get("shoppingListId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return;
  }

  // The insert RLS policy on shopping_list_items already checks that
  // shopping_list_id points at a list owned by this user — a crafted id
  // for someone else's list is rejected by Postgres itself, not by app
  // code here.
  await supabase.from("shopping_list_items").insert({
    shopping_list_id: parsed.data.shoppingListId,
    name: parsed.data.name,
    is_manual: true,
  });

  revalidatePath("/shopping-list");
}

export async function toggleItemChecked(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const itemId = formData.get("itemId") as string | null;
  const currentlyChecked = formData.get("isChecked") === "true";
  if (!itemId) {
    return;
  }

  await supabase
    .from("shopping_list_items")
    .update({ is_checked: !currentlyChecked })
    .eq("id", itemId);

  revalidatePath("/shopping-list");
}

export async function removeItem(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const itemId = formData.get("itemId") as string | null;
  if (!itemId) {
    return;
  }

  // No user_id column lives directly on shopping_list_items — ownership
  // is enforced entirely by RLS via the join to shopping_lists, so
  // there's no extra .eq() to add here the way other actions in this app
  // add one as a second layer.
  await supabase.from("shopping_list_items").delete().eq("id", itemId);

  revalidatePath("/shopping-list");
}
