// Covers the two functions the shopping list's ingredient-combining
// relies on (see apps/web/src/app/shopping-list/actions.ts) — this is the
// trickiest, least-visually-obvious logic in the app: a bug here doesn't
// crash anything, it just quietly merges (or fails to merge, or
// mis-converts) grocery quantities, which is very easy to not notice
// until a shopping list is just wrong at the store.
import { describe, expect, it } from "vitest";
import { normalizeUnit, pickDisplayUnit } from "./units";

describe("normalizeUnit", () => {
  it("recognizes common aliases case-insensitively", () => {
    expect(normalizeUnit("Tbsp")).toEqual({ group: "volume", label: "tbsp", toBase: 14.7868 });
    expect(normalizeUnit("TABLESPOONS")).toEqual({ group: "volume", label: "tbsp", toBase: 14.7868 });
    expect(normalizeUnit(" cups ")).toEqual({ group: "volume", label: "cup", toBase: 236.588 });
  });

  it("treats weight oz and volume fl oz as different, non-interchangeable units", () => {
    expect(normalizeUnit("oz")?.group).toBe("weight");
    expect(normalizeUnit("fl oz")?.group).toBe("volume");
  });

  it("returns null for units it doesn't know how to convert", () => {
    expect(normalizeUnit("clove")).toBeNull();
    expect(normalizeUnit("can")).toBeNull();
    expect(normalizeUnit("to taste")).toBeNull();
  });

  it("returns null for empty/missing input rather than throwing", () => {
    expect(normalizeUnit(null)).toBeNull();
    expect(normalizeUnit(undefined)).toBeNull();
    expect(normalizeUnit("")).toBeNull();
  });
});

describe("pickDisplayUnit", () => {
  it("picks the largest unit that still displays as at least 1, imperial volume", () => {
    // Exactly one cup, summed in ml (the base unit) — enough to round up
    // to "cup" but not enough to round up again to "pint" (>= 473.176ml).
    expect(pickDisplayUnit("volume", "imperial", 236.588).label).toBe("cup");
  });

  it("steps up to the next unit once the smaller one would round to a big number", () => {
    // A gallon and a half, in ml
    const total = 3785.41 * 1.5;
    expect(pickDisplayUnit("volume", "imperial", total).label).toBe("gallon");
  });

  it("falls back to the smallest unit in the ladder for a very small amount", () => {
    // Less than a single teaspoon (in ml) — should still pick *something*
    // readable rather than an amount under 1 of anything.
    expect(pickDisplayUnit("volume", "imperial", 1).label).toBe("tsp");
  });

  it("uses the metric ladder when the system is metric", () => {
    const oneAndHalfLiters = 1500; // already in ml, the volume base unit
    expect(pickDisplayUnit("volume", "metric", oneAndHalfLiters).label).toBe("l");
    expect(pickDisplayUnit("volume", "metric", 500).label).toBe("ml");
  });

  it("handles weight the same way, both systems", () => {
    expect(pickDisplayUnit("weight", "imperial", 453.592 * 2).label).toBe("lb");
    expect(pickDisplayUnit("weight", "metric", 1500).label).toBe("kg");
    expect(pickDisplayUnit("weight", "metric", 50).label).toBe("g");
  });
});
