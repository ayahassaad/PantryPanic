// Shared ingredient shape — used by the manual "add a recipe" form, the
// AI recipe suggestion, and the shopping list's aisle grouping. Keeping
// this in one place means all three stay in exact agreement on what a
// "category" is allowed to be.

import { z } from "zod";

export const INGREDIENT_CATEGORIES = [
  "produce",
  "meat-seafood",
  "dairy-eggs",
  "bakery",
  "pantry",
  "frozen",
  "spices-condiments",
  "beverages",
  "other",
] as const;

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

export const INGREDIENT_CATEGORY_LABELS: Record<IngredientCategory, string> = {
  produce: "Produce",
  "meat-seafood": "Meat & Seafood",
  "dairy-eggs": "Dairy & Eggs",
  bakery: "Bakery",
  pantry: "Pantry",
  frozen: "Frozen",
  "spices-condiments": "Spices & Condiments",
  beverages: "Beverages",
  other: "Other",
};

// quantity/unit are optional — plenty of real ingredients don't have a
// countable amount ("salt to taste"), and forcing one would just push
// people toward typing garbage into the field.
export const RecipeIngredientSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.number().positive().max(10000).optional(),
  unit: z.string().trim().min(1).max(30).optional(),
  category: z.enum(INGREDIENT_CATEGORIES),
});
export type RecipeIngredientInput = z.infer<typeof RecipeIngredientSchema>;
