// RecipeIngredientSchema is the one shape shared by the manual "add a
// recipe" form, the AI recipe suggester, and the shopping list — these
// tests are mostly about the optional-quantity/unit rule, since that's
// the part every one of those three inputs has to agree on ("salt to
// taste" has no countable amount, and forcing one would just push people
// toward typing garbage into the field).
import { describe, expect, it } from "vitest";
import { RecipeIngredientSchema } from "./ingredient";

describe("RecipeIngredientSchema", () => {
  it("accepts a full row with quantity and unit", () => {
    const result = RecipeIngredientSchema.safeParse({
      name: "garlic",
      quantity: 2,
      unit: "cloves",
      category: "produce",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a row with no quantity or unit at all", () => {
    const result = RecipeIngredientSchema.safeParse({
      name: "salt",
      category: "spices-condiments",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const result = RecipeIngredientSchema.safeParse({
      category: "produce",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a category outside the fixed aisle list", () => {
    const result = RecipeIngredientSchema.safeParse({
      name: "garlic",
      category: "not-a-real-aisle",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a zero or negative quantity", () => {
    expect(
      RecipeIngredientSchema.safeParse({ name: "flour", quantity: 0, category: "pantry" }).success,
    ).toBe(false);
    expect(
      RecipeIngredientSchema.safeParse({ name: "flour", quantity: -1, category: "pantry" }).success,
    ).toBe(false);
  });

  it("rejects an unreasonably large quantity", () => {
    const result = RecipeIngredientSchema.safeParse({
      name: "flour",
      quantity: 999999,
      category: "pantry",
    });
    expect(result.success).toBe(false);
  });
});
