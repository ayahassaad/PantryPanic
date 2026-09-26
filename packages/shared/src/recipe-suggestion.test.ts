// The AI recipe suggester's whole reliability story rests on this schema:
// generateRecipeSuggestion/generateWeekSuggestions (apps/web/src/lib/
// anthropic/suggest-recipe.ts) hand Claude's raw tool-call output straight
// through RecipeSuggestionSchema.safeParse before trusting any of it, so
// this is the actual thing standing between "a weird/truncated model
// response" and a broken recipe saved to someone's library.
import { describe, expect, it } from "vitest";
import { RecipeSuggestionInputSchema, RecipeSuggestionSchema } from "./recipe-suggestion";

describe("RecipeSuggestionInputSchema", () => {
  it("accepts a minimal valid input", () => {
    const result = RecipeSuggestionInputSchema.safeParse({
      ingredients: ["chicken thighs", "rice"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts the full set of optional fields", () => {
    const result = RecipeSuggestionInputSchema.safeParse({
      ingredients: ["chicken thighs"],
      mealSlot: "dinner",
      constraints: "quick weeknight meal",
      dietaryPreferences: ["gluten-free"],
      allergies: ["peanuts"],
      unitSystem: "metric",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty ingredients list", () => {
    const result = RecipeSuggestionInputSchema.safeParse({ ingredients: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a mealSlot outside breakfast/lunch/dinner", () => {
    const result = RecipeSuggestionInputSchema.safeParse({
      ingredients: ["eggs"],
      mealSlot: "brunch",
    });
    expect(result.success).toBe(false);
  });
});

describe("RecipeSuggestionSchema (validates Claude's tool-call output)", () => {
  const validRecipe = {
    title: "Garlic Rice Bowl",
    description: "A quick weeknight bowl built around what's on hand.",
    ingredients: [{ name: "rice", quantity: 2, unit: "cups", category: "pantry" }],
    steps: ["Cook the rice.", "Stir in the garlic."],
  };

  it("accepts a well-formed recipe", () => {
    expect(RecipeSuggestionSchema.safeParse(validRecipe).success).toBe(true);
  });

  it("rejects a recipe with no ingredients — a truncated/malformed model response", () => {
    const result = RecipeSuggestionSchema.safeParse({ ...validRecipe, ingredients: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a recipe with no steps", () => {
    const result = RecipeSuggestionSchema.safeParse({ ...validRecipe, steps: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a recipe missing a title or description entirely", () => {
    const { title: _title, ...withoutTitle } = validRecipe;
    expect(RecipeSuggestionSchema.safeParse(withoutTitle).success).toBe(false);

    const { description: _description, ...withoutDescription } = validRecipe;
    expect(RecipeSuggestionSchema.safeParse(withoutDescription).success).toBe(false);
  });

  it("rejects a recipe whose ingredient rows don't match RecipeIngredientSchema", () => {
    const result = RecipeSuggestionSchema.safeParse({
      ...validRecipe,
      ingredients: [{ name: "rice", category: "not-a-real-aisle" }],
    });
    expect(result.success).toBe(false);
  });
});
