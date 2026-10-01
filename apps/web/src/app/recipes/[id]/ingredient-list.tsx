"use client";

import { useState } from "react";

export interface IngredientListItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
}

// Half-batch up to ten times the recipe, in half steps.
const MIN_SCALE = 0.5;
const MAX_SCALE = 10;
const SCALE_STEP = 0.5;

function formatAmount(quantity: number | null, scale: number): string | null {
  if (quantity == null) {
    return null;
  }
  // Rounded to 2 decimal places for display, same as the shopping list,
  // so 1.5 × 0.333 never shows up as "0.49950000000000006".
  return String(Math.round(quantity * scale * 100) / 100);
}

// The recipe page's ingredient list, with a − / + scaler that multiplies
// every quantity. A multiplier ("2×"), not a serving count: recipes here
// don't record how many they serve as written — the planner's servings
// number works the same way (see syncShoppingListFromPlanner: "servings:
// 2" means twice the recipe) — so "make it for 6" can't be computed, but
// "make double" can. Ingredients with no quantity ("salt, to taste") are
// simply shown as they are at every scale. Nothing is saved: it's a
// viewing aid for this visit, and always opens at 1×.
//
// Each line can also be ticked off while cooking — a real checkbox,
// visually hidden, with the visible dot and text styled off its :checked
// state (Tailwind's peer-checked), the same way the steps list on the
// page does it. Deliberately uncontrolled, so the ticks survive changing
// the scale.
export function IngredientList({ ingredients }: { ingredients: IngredientListItem[] }) {
  const [scale, setScale] = useState(1);

  function adjust(delta: number) {
    setScale((current) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, current + delta)));
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-xs font-semibold uppercase tracking-widest text-leaf-600">
          Ingredients
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-ink-soft">Scale</span>
          <div className="flex items-center rounded-full border-2 border-ink text-ink">
            <button
              type="button"
              onClick={() => adjust(-SCALE_STEP)}
              disabled={scale <= MIN_SCALE}
              aria-label="Make a smaller batch"
              className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-base font-bold leading-none transition hover:bg-black/10 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              &minus;
            </button>
            <span
              aria-live="polite"
              className="min-w-9 px-0.5 text-center text-xs font-bold tabular-nums"
            >
              {scale}&times;
            </span>
            <button
              type="button"
              onClick={() => adjust(SCALE_STEP)}
              disabled={scale >= MAX_SCALE}
              aria-label="Make a bigger batch"
              className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-base font-bold leading-none transition hover:bg-black/10 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {ingredients.map((ingredient) => (
          <li key={ingredient.id}>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-bold text-ink">
              <input type="checkbox" className="peer sr-only" />
              <span
                aria-hidden
                className="flex h-4 w-4 flex-none items-center justify-center rounded-full border-2 border-ink bg-cream-card text-[9px] leading-none text-transparent transition peer-checked:bg-leaf-400 peer-checked:text-ink peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-1"
              >
                &#10003;
              </span>
              <span className="transition peer-checked:text-ink-faint peer-checked:line-through">
                {[formatAmount(ingredient.quantity, scale), ingredient.unit, ingredient.name]
                  .filter(Boolean)
                  .join(" ")}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}
