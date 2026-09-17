"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { MealSlot } from "@pantry-panic/shared";
import { removeMealPlanEntry, setMealPlanEntry } from "./actions";

interface RecipeOption {
  id: string;
  title: string;
}

interface PlannerEntryView {
  id: string;
  recipeId: string | null;
  recipeTitle: string | null;
  servings: number;
}

// A Next.js redirect() (e.g. "not logged in any more") works by throwing
// a special error with a digest starting "NEXT_REDIRECT" — Next's own
// runtime catches that to perform the navigation. If the catch block
// below swallowed it like a normal error, the redirect would silently
// never happen, so it's explicitly let through instead.
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

interface PlannerCellProps {
  dateISO: string;
  slot: MealSlot;
  initialEntry: PlannerEntryView | null;
  recipes: RecipeOption[];
  hasRecipes: boolean;
  cellClass: string;
  textClass: string;
}

// Removing a planned meal now clears the cell the instant you click
// "remove" instead of waiting on the round trip to Supabase — same
// pattern as the shopping list checkbox and the recipe favorite star.
// Assigning a recipe still submits a normal form (picking one from the
// dropdown and clicking "Set" is a deliberate, one-off action rather
// than something you'd click repeatedly and expect to feel instant), so
// that half is unchanged.
export function PlannerCell({
  dateISO,
  slot,
  initialEntry,
  recipes,
  hasRecipes,
  cellClass,
  textClass,
}: PlannerCellProps) {
  const [entry, setEntry] = useState(initialEntry);
  const [, startTransition] = useTransition();

  function handleRemove() {
    if (!entry) {
      return;
    }
    const removedEntry = entry;
    setEntry(null);

    startTransition(async () => {
      try {
        await removeMealPlanEntry(removedEntry.id);
      } catch (error) {
        if (isRedirectError(error)) {
          throw error;
        }
        // Couldn't actually delete it — put it back rather than leave
        // the planner quietly wrong.
        setEntry(removedEntry);
      }
    });
  }

  if (entry) {
    return (
      <div
        className={`flex min-h-[92px] flex-col justify-between rounded-[12px_15px_11px_14px] border-2 border-ink p-2.5 ${cellClass}`}
      >
        <div className={`flex h-full flex-col justify-between gap-1 ${textClass}`}>
          <div>
            {entry.recipeId ? (
              <Link
                href={`/recipes/${entry.recipeId}`}
                className="font-display text-xs font-semibold hover:underline"
              >
                {entry.recipeTitle}
              </Link>
            ) : (
              <span className="text-xs" style={{ opacity: 0.75 }}>
                Recipe removed
              </span>
            )}
            {entry.servings > 1 && (
              <p className="text-[10px]" style={{ opacity: 0.8 }}>
                {entry.servings} servings
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="text-left text-[10px] font-bold underline"
            style={{ opacity: 0.8 }}
          >
            &times; remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[92px] items-center justify-center rounded-xl border-2 border-dashed border-ink-faint p-2">
      {hasRecipes ? (
        <form action={setMealPlanEntry} className="flex h-full w-full flex-col justify-center gap-1">
          <input type="hidden" name="planDate" value={dateISO} />
          <input type="hidden" name="mealSlot" value={slot} />
          <select
            name="recipeId"
            required
            defaultValue=""
            className="w-full rounded-lg border-2 border-ink-faint bg-cream-card px-1 py-1 text-[11px] text-ink outline-none focus:border-ink"
          >
            <option value="" disabled>
              + Add
            </option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg border-2 border-ink bg-cream-deep px-1 py-0.5 font-display text-[10px] font-semibold text-ink transition hover:bg-cream"
          >
            Set
          </button>
        </form>
      ) : (
        <span className="text-2xl text-ink-faint">+</span>
      )}
    </div>
  );
}
