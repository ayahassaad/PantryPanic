// Unit conversion for combining shopping-list quantities across recipes.
//
// This intentionally only converts *within* a physical dimension — volume
// units (tsp, tbsp, cup, ...) convert to other volume units, weight units
// (g, oz, lb, ...) convert to other weight units. It never converts volume
// to weight (e.g. cups of flour to grams of flour) because that depends on
// the density of the specific ingredient, which we don't have data for.
// "1 cup flour" and "120 g flour" are left as two separate lines rather
// than guessed at.

export type UnitGroup = "volume" | "weight";

export interface NormalizedUnit {
  group: UnitGroup;
  label: string;
  toBase: number;
}

interface UnitDefinition {
  label: string;
  group: UnitGroup;
  // Multiplier to convert one of this unit into the group's base unit
  // (milliliters for volume, grams for weight). Base units are chosen
  // small so every other unit in the group is a clean multiple of them —
  // summing in milliliters/grams avoids the rounding drift you'd get
  // summing directly in, say, cups while mixing in tablespoons.
  toBase: number;
  // Every spelling someone (or Claude) might type for this unit, lowercase.
  // The canonical label is included as its own alias so a value already in
  // canonical form still round-trips through normalizeUnit().
  aliases: string[];
}

const UNIT_DEFINITIONS: UnitDefinition[] = [
  // Volume — these are exact volume-to-volume ratios (US customary +
  // metric), so they're safe regardless of what's being measured.
  { label: "tsp", group: "volume", toBase: 4.92892, aliases: ["tsp", "tsps", "teaspoon", "teaspoons"] },
  { label: "tbsp", group: "volume", toBase: 14.7868, aliases: ["tbsp", "tbsps", "tablespoon", "tablespoons"] },
  { label: "fl oz", group: "volume", toBase: 29.5735, aliases: ["fl oz", "fl. oz", "fluid ounce", "fluid ounces", "floz"] },
  { label: "cup", group: "volume", toBase: 236.588, aliases: ["cup", "cups", "c"] },
  { label: "pint", group: "volume", toBase: 473.176, aliases: ["pint", "pints", "pt"] },
  { label: "quart", group: "volume", toBase: 946.353, aliases: ["quart", "quarts", "qt"] },
  { label: "gallon", group: "volume", toBase: 3785.41, aliases: ["gallon", "gallons", "gal"] },
  { label: "ml", group: "volume", toBase: 1, aliases: ["ml", "milliliter", "milliliters", "millilitre", "millilitres"] },
  { label: "l", group: "volume", toBase: 1000, aliases: ["l", "liter", "liters", "litre", "litres"] },

  // Weight — pure mass-to-mass ratios, same reasoning. "oz" defaults to
  // the weight ounce here; fluid ounce requires writing "fl oz" — the two
  // are genuinely ambiguous from the string alone, and weight is the more
  // common meaning for solid ingredients ("8 oz cheese").
  { label: "g", group: "weight", toBase: 1, aliases: ["g", "gram", "grams"] },
  { label: "kg", group: "weight", toBase: 1000, aliases: ["kg", "kilogram", "kilograms"] },
  { label: "oz", group: "weight", toBase: 28.3495, aliases: ["oz", "ounce", "ounces"] },
  { label: "lb", group: "weight", toBase: 453.592, aliases: ["lb", "lbs", "pound", "pounds"] },
];

const ALIAS_LOOKUP = new Map<string, UnitDefinition>();
for (const def of UNIT_DEFINITIONS) {
  for (const alias of def.aliases) {
    ALIAS_LOOKUP.set(alias, def);
  }
}

// Looks up a free-text unit string ("Tbsp", "Tablespoons", " cups ") and
// returns which convertible family it belongs to, or null if it's not one
// we know how to convert (e.g. "clove", "can", "pinch") — those still work
// fine in the shopping list, they just only combine on an exact string
// match, same as before unit conversion existed.
export function normalizeUnit(raw: string | null | undefined): NormalizedUnit | null {
  if (!raw) return null;
  const def = ALIAS_LOOKUP.get(raw.trim().toLowerCase());
  if (!def) return null;
  return { group: def.group, label: def.label, toBase: def.toBase };
}

export type UnitSystem = "metric" | "imperial";

// Which units of each group belong to which system, ordered smallest to
// largest — this is what lets a combined shopping-list total (already
// summed in the group's base unit) get displayed in whichever system the
// shopper actually uses, instead of always picking whatever unit
// happened to be the largest one a recipe used.
const METRIC_LADDER: Record<UnitGroup, string[]> = {
  volume: ["ml", "l"],
  weight: ["g", "kg"],
};
const IMPERIAL_LADDER: Record<UnitGroup, string[]> = {
  volume: ["tsp", "tbsp", "fl oz", "cup", "pint", "quart", "gallon"],
  weight: ["oz", "lb"],
};

// Picks the most readable unit to display a total that's already been
// summed in the group's base unit (ml for volume, g for weight) — e.g.
// "1.5 l" instead of "1500 ml", or "2 lb" instead of "32 oz". Walks the
// preferred system's units largest-first and picks the largest one that
// still displays as at least 1, falling back to the smallest unit in the
// ladder for very small amounts ("0.3 tsp" is more honest than a tiny
// fraction of a gallon). Driven purely by the total and the chosen
// system, so — like normalizeUnit's callers rely on — it's deterministic
// regardless of what order rows came back from the database.
export function pickDisplayUnit(
  group: UnitGroup,
  system: UnitSystem,
  totalBase: number,
): NormalizedUnit {
  const ladder = (system === "metric" ? METRIC_LADDER : IMPERIAL_LADDER)[group];
  const defs = ladder
    .map((label) => ALIAS_LOOKUP.get(label))
    .filter((d): d is UnitDefinition => Boolean(d))
    .sort((a, b) => b.toBase - a.toBase); // largest first

  const chosen =
    defs.find((d) => totalBase / d.toBase >= 1) ?? defs[defs.length - 1] ?? defs[0];

  if (!chosen) {
    // The ladders above are hardcoded to labels that always exist in
    // ALIAS_LOOKUP — this is unreachable, but keeps the return type
    // honest without reaching for a cast.
    return { group, label: "", toBase: 1 };
  }

  return { group, label: chosen.label, toBase: chosen.toBase };
}
