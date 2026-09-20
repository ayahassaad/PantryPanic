"use server";

// Backs the "Fill week with AI" button (see fill-week-button.tsx). One
// Claude call returns a whole batch of recipes — one per currently-empty
// slot in the given week — which then all get saved to the library and
// assigned in the same pass. See the comment on FILL_WEEK_TOOL in
// lib/anthropic/suggest-recipe.ts for why this is a single batched call
// rather than looping the single-suggestion action once per empty box.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MEAL_SLOTS, type MealSlot } from "@pantry-panic/shared";
import { addDays, toISODate } from "@/lib/week";
import { createClient } from "@/lib/supabase/server";
import {
  generateWeekSuggestions,
  MissingApiKeyError,
  RecipeSuggestionUpstreamError,
} from "@/lib/anthropic/suggest-recipe";

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const FillWeekSchema = z.object({
  weekStartISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ingredients: z.array(z.string().trim().min(1).max(80)).max(60),
  constraints: z.string().trim().max(300).optional(),
});

// Same shared counter suggestRecipe/suggestRecipeAndAssign use, and the
// same limit — one "fill the week" click is exactly one Claude call (see
// generateWeekSuggestions), same as one single-recipe ask, so it costs
// the same 1 request against the daily budget rather than needing its
// own separate cap.
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_HOURS = 24;

export async function fillWeekWithAi(
  formData: FormData,
): Promise<{ error?: string; filledCount?: number; requestedCount?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const ingredientsRaw = (formData.get("ingredients") as string) ?? "";
  const ingredients = ingredientsRaw.split("\n").map((line) => line.trim()).filter(Boolean);
  const constraintsRaw = ((formData.get("constraints") as string) ?? "").trim();

  const parsed = FillWeekSchema.safeParse({
    weekStartISO: formData.get("weekStartISO"),
    ingredients,
    constraints: constraintsRaw || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Couldn't tell which week this was for." };
  }
  const { weekStartISO } = parsed.data;

  const weekStart = new Date(`${weekStartISO}T00:00:00Z`);
  const weekEndISO = toISODate(addDays(weekStart, 6));

  // Which of this week's 21 (day, slot) pairs are already planned — the
  // fill only ever targets what's left blank, never overwrites a meal
  // that's already there.
  const { data: existingEntries, error: fetchError } = await supabase
    .from("meal_plan_entries")
    .select("plan_date, meal_slot")
    .eq("user_id", user.id)
    .gte("plan_date", weekStartISO)
    .lte("plan_date", weekEndISO)
    .returns<Array<{ plan_date: string; meal_slot: MealSlot }>>();

  if (fetchError) {
    return { error: "Couldn't check what's already planned this week." };
  }

  const filledCells = new Set((existingEntries ?? []).map((e) => `${e.plan_date}_${e.meal_slot}`));

  const emptySlots: Array<{ dateISO: string; mealSlot: MealSlot; label: string }> = [];
  for (let i = 0; i < 7; i++) {
    const dateISO = toISODate(addDays(weekStart, i));
    for (const mealSlot of MEAL_SLOTS) {
      if (!filledCells.has(`${dateISO}_${mealSlot}`)) {
        emptySlots.push({ dateISO, mealSlot, label: `${WEEKDAY_NAMES[i]} ${mealSlot}` });
      }
    }
  }

  if (emptySlots.length === 0) {
    return { error: "This week's already fully planned — nothing empty to fill." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_size, dietary_preferences, allergies, unit_system")
    .eq("id", user.id)
    .maybeSingle<{
      household_size: number;
      dietary_preferences: string[];
      allergies: string[];
      unit_system: "metric" | "imperial";
    }>();

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { count: recentRequestCount, error: countError } = await supabase
    .from("ai_recipe_requests")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .gte("created_at", since);

  if (countError) {
    console.error("[planner/fill-week-actions] couldn't check AI rate limit, allowing request:", countError);
  } else if ((recentRequestCount ?? 0) >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      error: `You've hit the limit of ${RATE_LIMIT_MAX_REQUESTS} AI suggestions per day. Try again later, or fill the rest in yourself for now.`,
    };
  }

  const { error: logError } = await supabase.from("ai_recipe_requests").insert({ owner_id: user.id });
  if (logError) {
    console.error("[planner/fill-week-actions] failed to log AI request:", logError);
  }

  let result: Awaited<ReturnType<typeof generateWeekSuggestions>>;
  try {
    result = await generateWeekSuggestions({
      slotLabels: emptySlots.map((s) => s.label),
      ingredients: parsed.data.ingredients,
      constraints: parsed.data.constraints,
      dietaryPreferences: profile?.dietary_preferences?.length ? profile.dietary_preferences : undefined,
      allergies: profile?.allergies?.length ? profile.allergies : undefined,
      unitSystem: profile?.unit_system,
    });
  } catch (error) {
    console.error("[planner/fill-week-actions] generateWeekSuggestions failed:", error);
    const message =
      error instanceof MissingApiKeyError
        ? "Recipe suggestions aren't set up yet. Ask whoever runs this app to add an Anthropic API key."
        : error instanceof RecipeSuggestionUpstreamError
          ? error.message
          : "Couldn't fill the week. Try again.";
    return { error: message };
  }

  // Defensive zip: the model is asked for exactly emptySlots.length
  // recipes and usually delivers, but never assume — pair up only as
  // many as actually came back, by position.
  const pairs: Array<{ slot: (typeof emptySlots)[number]; recipe: (typeof result.recipes)[number] }> = [];
  emptySlots.forEach((slot, i) => {
    const recipe = result.recipes[i];
    if (recipe) {
      pairs.push({ slot, recipe });
    }
  });

  if (pairs.length === 0) {
    return { error: "Didn't get any usable suggestions back. Try again." };
  }

  const servings = profile?.household_size ?? 2;

  const { data: insertedRecipes, error: recipesError } = await supabase
    .from("recipes")
    .insert(
      pairs.map(({ slot, recipe }) => ({
        owner_id: user.id,
        title: recipe.title,
        description: recipe.description,
        steps: recipe.steps,
        tags: [slot.mealSlot],
        source: "ai" as const,
        ai_prompt: result.prompt,
      })),
    )
    .select("id");

  if (recipesError || !insertedRecipes || insertedRecipes.length !== pairs.length) {
    return { error: recipesError?.message ?? "Couldn't save the suggested recipes." };
  }

  const ingredientRows = pairs.flatMap(({ recipe }, i) =>
    recipe.ingredients.map((ingredient, index) => ({
      recipe_id: insertedRecipes[i]!.id,
      name: ingredient.name,
      quantity: ingredient.quantity ?? null,
      unit: ingredient.unit ?? null,
      category: ingredient.category,
      sort_order: index,
    })),
  );
  if (ingredientRows.length > 0) {
    const { error: ingredientsError } = await supabase.from("recipe_ingredients").insert(ingredientRows);
    if (ingredientsError) {
      // The recipes themselves saved fine — not worth failing the whole
      // fill over this, just log it. Worst case some show up with no
      // ingredient list.
      console.error("[planner/fill-week-actions] failed to save ingredients:", ingredientsError);
    }
  }

  const planRows = pairs.map(({ slot }, i) => ({
    user_id: user.id,
    recipe_id: insertedRecipes[i]!.id,
    plan_date: slot.dateISO,
    meal_slot: slot.mealSlot,
    servings,
  }));

  const { error: upsertError } = await supabase
    .from("meal_plan_entries")
    .upsert(planRows, { onConflict: "user_id,plan_date,meal_slot" });

  if (upsertError) {
    return {
      error:
        "Saved the recipes to your library, but couldn't slot them into the week. Find them under Recipes.",
    };
  }

  revalidatePath("/planner");
  return { filledCount: pairs.length, requestedCount: emptySlots.length };
}
