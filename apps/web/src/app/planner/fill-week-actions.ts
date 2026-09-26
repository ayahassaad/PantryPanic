"use server";

// Backs the "Fill week with AI" button (see fill-week-button.tsx). The
// user picks up to MAX_SELECTED_SLOTS empty meals by clicking boxes on
// the planner grid itself (see fill-week-selection.tsx); one Claude call
// returns one recipe per picked slot, which then all get saved to the
// library and assigned in the same pass. See the comment on
// FILL_WEEK_TOOL in lib/anthropic/suggest-recipe.ts for why this is
// batched at all rather than looping the single-suggestion action once
// per slot.
//
// The MAX_SELECTED_SLOTS cap isn't arbitrary: asking for a full 21-slot
// empty week's worth of recipes (title + description + a real ingredient
// list + steps, each) in one response reliably ran past the model's
// output budget and came back truncated — Anthropic hands back an
// unparseable partial tool call in that case, which surfaced here as a
// confusing "malformed batch" error. Capping how much one click can ask
// for at once (rather than silently splitting it into several Claude
// calls behind the scenes) keeps this simple: one click really is one
// call, and it reliably finishes.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type MealSlot } from "@pantry-panic/shared";
import { addDays, toISODate } from "@/lib/week";
import { createClient } from "@/lib/supabase/server";
import {
  generateWeekSuggestions,
  MissingApiKeyError,
  RecipeSuggestionUpstreamError,
} from "@/lib/anthropic/suggest-recipe";
import { MAX_SELECTED_SLOTS } from "./fill-week-constants";

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const SLOT_KEY_PATTERN = /^(\d{4}-\d{2}-\d{2})_(breakfast|lunch|dinner)$/;

const FillWeekSchema = z.object({
  weekStartISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Each entry is "YYYY-MM-DD_mealSlot", exactly what slotKey() in
  // fill-week-selection.tsx builds for each grid-cell pick.
  selectedSlots: z
    .array(z.string().regex(SLOT_KEY_PATTERN))
    .min(1, "Pick at least one meal to fill.")
    .max(MAX_SELECTED_SLOTS, `Pick at most ${MAX_SELECTED_SLOTS} meals at a time.`),
  ingredients: z.array(z.string().trim().min(1).max(80)).max(60),
  constraints: z.string().trim().max(300).optional(),
});

// Same shared counter suggestRecipe/suggestRecipeAndAssign use, and the
// same limit — one "fill" click is exactly one Claude call (see
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

  let selectedSlotsRaw: unknown;
  try {
    selectedSlotsRaw = JSON.parse((formData.get("selectedSlots") as string) ?? "[]");
  } catch {
    return { error: "Couldn't tell which meals to fill." };
  }

  const parsed = FillWeekSchema.safeParse({
    weekStartISO: formData.get("weekStartISO"),
    selectedSlots: selectedSlotsRaw,
    ingredients,
    constraints: constraintsRaw || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Couldn't tell which meals to fill." };
  }
  const { weekStartISO } = parsed.data;

  const weekStart = new Date(`${weekStartISO}T00:00:00Z`);
  const weekEndISO = toISODate(addDays(weekStart, 6));

  // Re-check what's actually planned right now — the grid selection was
  // built from whatever page.tsx last rendered, which can be stale
  // (another tab, or a meal added since these were picked). Never trust
  // the client's word for which slots are safe to overwrite.
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

  const targetSlots = parsed.data.selectedSlots
    .map((key) => {
      const match = key.match(SLOT_KEY_PATTERN);
      if (!match) return null;
      const [, dateISO, mealSlot] = match as [string, string, MealSlot];
      // Which weekday this date falls on, spelled out for the prompt
      // ("Monday breakfast") — computed relative to weekStart rather than
      // re-parsing with a day-name library, since this is just a label.
      const dayIndex = Math.round(
        (new Date(`${dateISO}T00:00:00Z`).getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000),
      );
      const dayName = WEEKDAY_NAMES[dayIndex] ?? dateISO;
      return { dateISO, mealSlot, label: `${dayName} ${mealSlot}` };
    })
    .filter((slot): slot is { dateISO: string; mealSlot: MealSlot; label: string } => slot !== null)
    // Drop anything that's not actually empty any more, or that fell
    // outside this week's range (dayIndex out of 0-6) — both defensive,
    // neither should happen from the UI itself.
    .filter((slot) => !filledCells.has(`${slot.dateISO}_${slot.mealSlot}`))
    .filter((slot) => slot.dateISO >= weekStartISO && slot.dateISO <= weekEndISO);

  if (targetSlots.length === 0) {
    return { error: "Those meals are already planned — refresh and try again." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_size, cuisine_preferences, dietary_preferences, allergies, unit_system")
    .eq("id", user.id)
    .maybeSingle<{
      household_size: number;
      cuisine_preferences: string[];
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
      slotLabels: targetSlots.map((s) => s.label),
      ingredients: parsed.data.ingredients,
      constraints: parsed.data.constraints,
      cuisinePreferences: profile?.cuisine_preferences?.length ? profile.cuisine_preferences : undefined,
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
          : "Couldn't fill those meals. Try again.";
    return { error: message };
  }

  // Defensive zip: the model is asked for exactly targetSlots.length
  // recipes and usually delivers, but never assume — pair up only as
  // many as actually came back, by position.
  const pairs: Array<{ slot: (typeof targetSlots)[number]; recipe: (typeof result.recipes)[number] }> = [];
  targetSlots.forEach((slot, i) => {
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
  return { filledCount: pairs.length, requestedCount: targetSlots.length };
}
