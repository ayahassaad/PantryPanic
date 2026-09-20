"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { MealSlot } from "@pantry-panic/shared";
import { assignMealPlanEntry, removeMealPlanEntry, updateMealPlanServings } from "./actions";

export interface RecipeOption {
  id: string;
  title: string;
  isFavorite: boolean;
}

export interface PlannerEntryView {
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

// How long a removed meal stays reversible before the delete actually
// hits the server — long enough to catch a misclick, short enough that
// it doesn't feel like the click didn't register.
const UNDO_WINDOW_MS = 5000;
const MIN_SERVINGS = 1;
const MAX_SERVINGS = 20;

interface PlannerCellProps {
  dateISO: string;
  slot: MealSlot;
  initialEntry: PlannerEntryView | null;
  recipes: RecipeOption[];
  hasRecipes: boolean;
  cellClass: string;
  textClass: string;
}

// Removing a planned meal clears the cell the instant you click the "x",
// and assigning one fills it the instant you pick a recipe — same
// optimistic-first pattern as the shopping list checkbox and the recipe
// favorite star, rather than waiting on the round trip to Supabase each
// time.
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
  const [pendingRemoval, setPendingRemoval] = useState<PlannerEntryView | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();
  const removalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clears any still-pending removal timer if the cell unmounts (e.g. the
  // week is changed) before the undo window runs out — otherwise it'd
  // fire the delete against a component that's no longer there to react
  // to the result.
  useEffect(() => {
    return () => {
      if (removalTimer.current) {
        clearTimeout(removalTimer.current);
      }
    };
  }, []);

  function handleRemove() {
    if (!entry) {
      return;
    }
    const removedEntry = entry;
    setEntry(null);
    setPendingRemoval(removedEntry);

    removalTimer.current = setTimeout(() => {
      removalTimer.current = null;
      setPendingRemoval(null);

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
    }, UNDO_WINDOW_MS);
  }

  function handleUndo() {
    if (removalTimer.current) {
      clearTimeout(removalTimer.current);
      removalTimer.current = null;
    }
    if (pendingRemoval) {
      setEntry(pendingRemoval);
      setPendingRemoval(null);
    }
  }

  function adjustServings(delta: number) {
    if (!entry) {
      return;
    }
    const nextServings = Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, entry.servings + delta));
    if (nextServings === entry.servings) {
      return;
    }
    const previousEntry = entry;
    setEntry({ ...entry, servings: nextServings });

    startTransition(async () => {
      try {
        await updateMealPlanServings(entry.id, nextServings);
      } catch (error) {
        if (isRedirectError(error)) {
          throw error;
        }
        setEntry(previousEntry);
      }
    });
  }

  function handleAssign(recipeId: string) {
    if (!recipeId || isAssigning) {
      return;
    }
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) {
      return;
    }
    setIsAssigning(true);
    setAssignError(null);

    startTransition(async () => {
      try {
        const result = await assignMealPlanEntry(recipeId, dateISO, slot);
        if (result.entryId) {
          setEntry({
            id: result.entryId,
            recipeId: recipe.id,
            recipeTitle: recipe.title,
            servings: result.servings ?? 1,
          });
          setQuery("");
        } else {
          // On error the cell was never shown as filled, so there's
          // nothing to revert — it just stays the empty "search" state
          // with a reason why.
          setAssignError(result.error ?? "Couldn't add that meal.");
        }
      } catch (error) {
        if (isRedirectError(error)) {
          throw error;
        }
        setAssignError("Couldn't add that meal.");
      } finally {
        setIsAssigning(false);
      }
    });
  }

  // Reversible removal: while pendingRemoval is set, the cell shows an
  // "Undo" chip instead of either its filled or empty state — the actual
  // delete doesn't reach the server until UNDO_WINDOW_MS passes with no
  // click.
  if (pendingRemoval) {
    return (
      <div className="flex h-[92px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-ink-faint p-2 text-center">
        <span className="text-[11px] font-semibold text-ink-soft">Removed</span>
        <button
          type="button"
          onClick={handleUndo}
          className="rounded-lg border-2 border-ink bg-cream-deep px-2.5 py-0.5 font-display text-[10px] font-semibold text-ink transition hover:bg-cream"
        >
          Undo
        </button>
      </div>
    );
  }

  // Fixed height (not min-height) so a filled cell is exactly the same
  // size as an empty "+ Add" one — a long recipe title used to push the
  // box taller than its neighbors and throw off the whole row. The title
  // is clamped to 2 lines instead, and the box itself is now the link to
  // the recipe (tap/click anywhere on the title for the full details and
  // instructions) with a servings stepper underneath and a small "x" in
  // the corner to remove it.
  if (entry) {
    return (
      <div
        className={`relative h-[92px] overflow-hidden rounded-[12px_15px_11px_14px] border-2 border-ink p-2 ${cellClass}`}
      >
        {entry.recipeId ? (
          <Link
            href={`/recipes/${entry.recipeId}`}
            className={`flex flex-col pr-5 transition hover:brightness-110 ${textClass}`}
          >
            <span className="line-clamp-2 font-display text-xs font-semibold leading-snug">
              {entry.recipeTitle}
            </span>
          </Link>
        ) : (
          <div className={`pr-5 ${textClass}`}>
            <span className="text-xs" style={{ opacity: 0.75 }}>
              Recipe removed
            </span>
          </div>
        )}

        {/* Small pill: numeral only (the "serving(s)" word is dropped
            from the visible label — there's no room for it at this
            width — but kept for screen readers via the sr-only span and
            the buttons' aria-labels). border-ink/40 instead of solid
            border-ink so the outline reads as a soft outline rather than
            a harsh black ring against the slot color. */}
        <div
          className={`mt-1 flex w-fit items-center gap-1 rounded-full border border-ink/40 px-1.5 py-0.5 ${textClass}`}
          style={{ opacity: 0.9 }}
        >
          <button
            type="button"
            onClick={() => adjustServings(-1)}
            disabled={entry.servings <= MIN_SERVINGS}
            aria-label="Fewer servings"
            className="flex-none text-[11px] font-bold leading-none transition hover:opacity-60 disabled:opacity-40"
          >
            &minus;
          </button>
          <span className="text-[10px] font-semibold tabular-nums">
            {entry.servings}
            <span className="sr-only">
              {" "}
              {entry.servings === 1 ? "serving" : "servings"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => adjustServings(1)}
            disabled={entry.servings >= MAX_SERVINGS}
            aria-label="More servings"
            className="flex-none text-[11px] font-bold leading-none transition hover:opacity-60 disabled:opacity-40"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleRemove}
          aria-label="Remove this meal"
          className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-sm font-bold leading-none transition hover:bg-black/10 ${textClass}`}
          style={{ opacity: 0.75 }}
        >
          &times;
        </button>
      </div>
    );
  }

  // Favorited recipes were already sorted to the front of `recipes` by
  // the planner page, so filtering here preserves that order — favorites
  // still show first among whatever matches the search text.
  const filteredRecipes = query.trim()
    ? recipes.filter((r) => r.title.toLowerCase().includes(query.trim().toLowerCase()))
    : recipes;

  return (
    <div className="flex h-[92px] flex-col justify-center gap-1 rounded-xl border-2 border-dashed border-ink-faint p-2">
      {hasRecipes ? (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes…"
            aria-label="Search recipes"
            disabled={isAssigning}
            className="w-full rounded-lg border-2 border-ink-faint bg-cream-card px-1.5 py-1 text-[11px] text-ink outline-none focus:border-ink disabled:opacity-60"
          />
          <select
            value=""
            onChange={(e) => handleAssign(e.target.value)}
            disabled={isAssigning}
            aria-label="Choose a recipe"
            className="w-full rounded-lg border-2 border-ink-faint bg-cream-card px-1 py-1 text-[11px] text-ink outline-none focus:border-ink disabled:opacity-60"
          >
            <option value="" disabled>
              {isAssigning ? "Adding…" : filteredRecipes.length === 0 ? "No matches" : "+ Add"}
            </option>
            {filteredRecipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.isFavorite ? `★ ${r.title}` : r.title}
              </option>
            ))}
          </select>
          {assignError && (
            <p className="text-[10px] font-bold leading-tight text-tomato-600">{assignError}</p>
          )}
        </>
      ) : (
        <span className="text-2xl text-ink-faint">+</span>
      )}
    </div>
  );
}
