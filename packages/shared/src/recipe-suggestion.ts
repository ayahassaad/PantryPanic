// Types and validation for the AI recipe-suggestion feature. Shared by the
// web app now and the mobile app later, so both sides agree on the exact
// input/output shape without duplicating it.

import { z } from "zod";
import type { MealSlot } from "./types";

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
  // Free-text dietary restrictions, time limits, "kid-friendly", etc.
  constraints: z.string().trim().max(300).optional(),
});
export type RecipeSuggestionInput = z.infer<typeof RecipeSuggestionInputSchema>;

export const RecipeSuggestionSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  usesFromPantry: z.array(z.string()),
  additionalIngredients: z.array(z.string()),
  steps: z.array(z.string()).min(1),
});
export type RecipeSuggestion = z.infer<typeof RecipeSuggestionSchema>;
