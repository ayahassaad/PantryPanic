"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { MealSlot } from "@pantry-panic/shared";
import { DoodleCarrot, DoodleGrapes } from "@/components/food-doodles";
import { removeMealPlanEntry, updateMealPlanServings } from "./actions";
import { RecipeModal } from "./recipe-modal";
import type { AssignedEntry } from "./recipe-actions";
import { useFillWeekSelection } from "./fill-week-selection";

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

// One shared height for all three cell states (filled, empty, pending
// removal) so a row stays even regardless of which state each day's cell
// is in — same reasoning as the old fixed 92px, just taller now that the
// grid has more page to work with (see the wider max-w on the planner
// page itself).
const CELL_HEIGHT = "h-[150px]";

// A couple of small doodles that fall inside a cell picked for "Fill
// week with AI" — same falling idea as the recipe card hover and the
// today column (see .selected-doodle-fall in globals.css), just scaled
// down to fit a single ~150px cell without crowding the "+ Add meal"
// button. Two is plenty at this size; more just reads as clutter.
const SELECTED_CELL_DOODLES: Array<{ Shape: typeof DoodleCarrot; left: string; delay: string }> = [
  { Shape: DoodleCarrot, left: "18%", delay: "0s" },
  { Shape: DoodleGrapes, left: "62%", delay: "1.5s" },
];

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
  // Whether RecipeModal is open — it owns all three ways of filling this
  // cell (pick existing / type it in / ask AI) now, so this is just a
  // boolean rather than tracking which tab.
  const [modalOpen, setModalOpen] = useState(false);
  const [, startTransition] = useTransition();
  const removalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isSelected, isSelecting, toggle: toggleFillSelection } = useFillWeekSelection();
  const selectedForFill = isSelected(dateISO, slot);

  // Every other update to this cell (add/remove/servings) is done
  // optimistically by calling a server action directly and setting local
  // state from its result — the page around it is never asked to
  // refetch. "Fill week" is the one exception: it can touch a dozen-plus
  // cells at once, far more than any single PlannerCell instance knows
  // about, so it works the ordinary Next.js way (write to the DB, then
  // router.refresh() the page) instead. A router.refresh() alone doesn't
  // update an already-mounted component's own useState — only the props
  // Next hands back down — so this syncs `entry` to `initialEntry`
  // whenever a fresh one arrives. Harmless the rest of the time: nothing
  // in this file triggers a router.refresh(), so in normal use this
  // effect only ever fires once, on mount, setting the same value
  // useState already initialized with.
  useEffect(() => {
    setEntry(initialEntry);
  }, [initialEntry]);

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

  // Shared by all three RecipeModal tabs (see recipe-modal.tsx) — each
  // one hands back exactly the shape PlannerEntryView needs (id,
  // recipeId, recipeTitle, servings), whether that came from picking an
  // existing recipe, typing a new one in, or an AI suggestion.
  function handleCreated(created: AssignedEntry) {
    setEntry(created);
    setModalOpen(false);
  }

  // Reversible removal: while pendingRemoval is set, the cell shows an
  // "Undo" chip instead of either its filled or empty state — the actual
  // delete doesn't reach the server until UNDO_WINDOW_MS passes with no
  // click.
  if (pendingRemoval) {
    return (
      <div className={`flex ${CELL_HEIGHT} flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-ink-faint p-2 text-center`}>
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
  // is clamped to 3 lines instead, and the box itself is now the link to
  // the recipe (tap/click anywhere on the title for the full details and
  // instructions), flex-col + justify-between so the servings stepper
  // sits pinned near the bottom rather than floating right under a short
  // title with a dead gap below it, and a small "x" in the corner to
  // remove it.
  if (entry) {
    return (
      <div
        className={`relative flex ${CELL_HEIGHT} flex-col overflow-hidden rounded-[12px_15px_11px_14px] border-2 border-ink p-2.5 ${cellClass}`}
      >
        {entry.recipeId ? (
          <Link
            href={`/recipes/${entry.recipeId}`}
            className={`flex flex-1 flex-col pr-5 transition hover:brightness-110 ${textClass}`}
          >
            <span className="line-clamp-3 font-display text-sm font-semibold leading-snug">
              {entry.recipeTitle}
            </span>
          </Link>
        ) : (
          <div className={`flex-1 pr-5 ${textClass}`}>
            <span className="text-xs" style={{ opacity: 0.75 }}>
              Recipe removed
            </span>
          </div>
        )}

        {/* Small pill: numeral only (the "serving(s)" word is dropped
            from the visible label — the box is still narrow even though
            it's now taller — but kept for screen readers via the
            sr-only span and the buttons' aria-labels). Border, buttons
            and numeral are all plain text-ink/border-ink (not the
            per-slot textClass) so the stepper reads the same solid
            black on every meal slot's color, matching the card's own
            black outline. mt-auto pins it to the bottom of the taller
            card instead of sitting right under the title. */}
        <div className="mt-auto flex w-fit items-center gap-1 rounded-full border border-ink px-1.5 py-0.5 text-ink">
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

  // One button, one door in: it opens RecipeModal, which handles picking
  // an existing recipe, typing a new one, or asking AI, all as tabs of
  // the same popup — see recipe-modal.tsx. Defaults to the "existing"
  // tab when there's a library to search, otherwise straight to "new"
  // since there's nothing to pick from yet.
  //
  // The rest of the box (anywhere but that button) doubles as a toggle
  // for "Fill week with AI" — but only once picking mode is on
  // (isSelecting, turned on by pressing that button — see
  // fill-week-selection.tsx). Until then this click does nothing, same
  // as the plain dashed box before this feature existed; toggle() itself
  // also no-ops while not selecting, so this is a style-only gate, not
  // the only thing preventing an accidental pick. The "+ Add meal"
  // button stops its own click from bubbling up so opening the modal and
  // toggling selection stay two separate gestures instead of both firing
  // at once.
  return (
    <>
      <div
        onClick={() => toggleFillSelection(dateISO, slot)}
        className={`relative flex ${CELL_HEIGHT} items-center justify-center overflow-hidden rounded-xl border-2 p-2.5 transition ${
          selectedForFill
            ? "cursor-pointer border-blueberry-400 bg-blueberry-50"
            : isSelecting
              ? "cursor-pointer border-dashed border-blueberry-400/40 hover:border-blueberry-400 hover:bg-blueberry-50"
              : "border-dashed border-ink-faint"
        }`}
      >
        {selectedForFill && (
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {SELECTED_CELL_DOODLES.map(({ Shape, left, delay }, i) => (
              <Shape
                key={i}
                className="selected-doodle-fall absolute top-0 h-3.5 w-3.5"
                style={{ left, animationDelay: delay }}
              />
            ))}
            <span className="absolute left-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-ink bg-blueberry-400 text-[9px] font-bold leading-none text-cream">
              &#10003;
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setModalOpen(true);
          }}
          className="wobble-btn relative z-10 border-2 border-ink-faint bg-cream-card px-4 py-2 font-display text-sm font-semibold text-ink-soft transition hover:border-ink hover:bg-cream-deep hover:text-ink"
        >
          + Add meal
        </button>
      </div>

      {modalOpen && (
        <RecipeModal
          dateISO={dateISO}
          slot={slot}
          recipes={recipes}
          hasRecipes={hasRecipes}
          defaultTab={hasRecipes ? "existing" : "new"}
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
