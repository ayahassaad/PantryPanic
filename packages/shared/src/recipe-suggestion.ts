// Types and validation for the AI recipe-suggestion feature. Shared by the
// web app now and the mobile app later, so both sides agree on the exact
// input/output shape without duplicating it.

import { z } from "zod";
import type { MealSlot } from "./types";
import { RecipeIngredientSchema } from "./ingredient";

// Deliberately the same three values meal_plan_entries.meal_slot allows
// (see supabase/migrations) — recipe suggestions stay in that vocabulary
// even though recipes.tags itself isn't constrained.
export const MEAL_SLOTS = [
  "breakfast",
  "lunch",
  "dinner",
] as const satisfies readonly MealSlot[];

export const RecipeSuggestionInputSchema = z.object({
  // What's on hand — the whole feature is "I have these, what can I make."
  ingredients: z
    .array(z.string().trim().min(1).max(80))
    .min(1, "List at least one ingredient.")
    .max(40, "That's a lot of ingredients — try narrowing it down."),
  mealSlot: z.enum(MEAL_SLOTS).optional(),
  // Free-text dietary restrictions, time limits, "kid-friendly", etc. —
  // typed fresh on the suggest form itself, on top of whatever's saved to
  // the profile below.
  constraints: z.string().trim().max(300).optional(),
  // Pulled from the user's profile (not typed on this form) — kept as
  // their own fields rather than folded into `constraints` so allergies
  // in particular can be phrased to the model as a hard exclusion, not
  // just another preference in a paragraph of free text.
  dietaryPreferences: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  allergies: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  // Matches the UnitSystem union in units.ts — spelled out here (rather
  // than imported) so this schema, which is the runtime source of truth
  // for the type below, doesn't take on a dependency for one string enum.
  unitSystem: z.enum(["metric", "imperial"]).optional(),
});
export type RecipeSuggestionInput = z.infer<typeof RecipeSuggestionInputSchema>;

// One flat, structured ingredient list — each entry carries its own
// quantity/unit/category, whether it's something from the pantry list
// the user typed in or extra the recipe needs. This is also exactly the
// shape recipe_ingredients rows need, so it maps straight into the
// database with no reshaping (previously this was two plain string
// arrays — usesFromPantry/additionalIngredients — but nothing downstream
// ever used that split once the recipe was saved, so it's gone now in
// favor of the structure the shopping list actually needs).
export const RecipeSuggestionSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  ingredients: z.array(RecipeIngredientSchema).min(1),
  steps: z.array(z.string()).min(1),
});
export type RecipeSuggestion = z.infer<typeof RecipeSuggestionSchema>;
