"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { MealSlot } from "@pantry-panic/shared";
import { DoodleCarrot, DoodleGrapes } from "@/components/food-doodles";
import { removeMealPlanEntry, restoreMealPlanEntry, updateMealPlanServings } from "./actions";
import { RecipeModal } from "./recipe-modal";
import type { AssignedEntry } from "./recipe-actions";
import { useFillWeekSelection } from "./fill-week-selection";
import { useMoveMeal } from "./move-meal";

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

// How long the "Undo" chip stays up after removing a meal. The delete
// itself now happens immediately (see handleRemove below) — this only
// controls how long you have to change your mind before the cell
// settles into its empty "+ Add meal" state.
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
  // A day before today — the cell is dimmed so the days still left to
  // plan stand out, but stays fully usable (you can still look back at,
  // or fix up, what you ate on Monday).
  isPast?: boolean;
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
  isPast = false,
}: PlannerCellProps) {
  // Back to full strength on hover/keyboard focus, so a past meal is
  // still comfortable to read or edit once you actually go to it.
  const pastClass = isPast ? "opacity-60 hover:opacity-100 focus-within:opacity-100" : "";
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
  const { moving, isBusy, startMove, cancelMove, dropOn } = useMoveMeal();
  const isMoveSource = moving !== null && moving.dateISO === dateISO && moving.slot === slot;
  // Only for the highlight while a dragged meal hovers over this cell —
  // :hover doesn't apply mid-drag, so it has to be tracked by hand.
  const [dragOver, setDragOver] = useState(false);
  // Both cells involved in a move pulse until the refreshed page shows
  // the result (see move-meal.tsx).
  const busyClass = isBusy(dateISO, slot) ? "animate-pulse" : "";

  useEffect(() => {
    if (!moving) {
      setDragOver(false);
    }
  }, [moving]);

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

  // Deletes right away — not after the undo window — so the meal (and
  // whatever it contributed to the shopping list, which rebuilds itself
  // from the planner on every visit) is genuinely gone on the server
  // straight away, not just hidden client-side. This used to be
  // deferred with a plain setTimeout that fired the actual delete 5s
  // later: refreshing the page (or just closing the tab) inside that
  // window unmounted this component first, which cancelled the timer
  // before it ever got a chance to run — so the "removed" meal, and its
  // shopping-list ingredients, would silently still be there. Undo now
  // works by putting the row back (see handleUndo) rather than by
  // racing to cancel a delete before it happens.
  function handleRemove() {
    if (!entry) {
      return;
    }
    const removedEntry = entry;
    setEntry(null);
    setPendingRemoval(removedEntry);

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
        setPendingRemoval(null);
        return;
      }
    });

    // Purely cosmetic from here: just swaps the "Removed / Undo" chip
    // back to the empty "+ Add meal" cell once the window's up. The
    // delete above has already happened by then regardless.
    removalTimer.current = setTimeout(() => {
      removalTimer.current = null;
      setPendingRemoval(null);
    }, UNDO_WINDOW_MS);
  }

  function handleUndo() {
    if (removalTimer.current) {
      clearTimeout(removalTimer.current);
      removalTimer.current = null;
    }
    const removed = pendingRemoval;
    if (!removed) {
      return;
    }
    setPendingRemoval(null);

    // recipeId is only ever missing here if the recipe it pointed at
    // isn't visible to this user any more (see the "Recipe removed"
    // rendering below) — vanishingly rare, and there's no id left to
    // restore, so undo can't bring this particular one back.
    if (!removed.recipeId) {
      return;
    }

    // Bring the cell back on screen right away; if the re-insert below
    // fails, drop it again rather than show a meal that isn't actually
    // saved.
    setEntry(removed);
    startTransition(async () => {
      try {
        const result = await restoreMealPlanEntry(
          removed.recipeId as string,
          dateISO,
          slot,
          removed.servings,
        );
        if (result.error || !result.entryId) {
          setEntry(null);
          return;
        }
        // The restore is a fresh insert, so it gets a new row id — swap
        // it in so a follow-up remove/servings-change targets the right
        // row.
        setEntry({ ...removed, id: result.entryId });
      } catch (error) {
        if (isRedirectError(error)) {
          throw error;
        }
        setEntry(null);
      }
    });
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

  // While a meal is picked up (dragged, or its Move button pressed —
  // see move-meal.tsx), every cell is covered by one big button: on the
  // cell it came from it cancels, on any other it's the drop target —
  // "Move here" for an empty slot, "Swap" for a filled one. Covering the
  // cell (rather than rewiring each control underneath) means nothing
  // else in it — the recipe link, the stepper, "+ Add meal" — can be hit
  // by accident mid-move, and the same element serves a click/tap and a
  // drag-and-drop drop alike.
  const moveOverlay = moving ? (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        if (isMoveSource) {
          cancelMove();
        } else {
          dropOn(dateISO, slot);
        }
      }}
      onDragOver={(event) => {
        if (isMoveSource) {
          return;
        }
        // preventDefault is what marks this element as a valid drop
        // target at all — without it the browser never fires "drop".
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDragEnter={() => setDragOver(true)}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        if (!isMoveSource) {
          dropOn(dateISO, slot);
        }
      }}
      aria-label={
        isMoveSource
          ? "Cancel moving this meal"
          : entry
            ? `Swap with ${entry.recipeTitle ?? "this meal"}`
            : "Move the meal here"
      }
      className={`absolute inset-0 z-20 flex items-center justify-center transition ${
        isMoveSource
          ? "bg-cream/70"
          : dragOver
            ? "bg-blueberry-400/40"
            : "bg-blueberry-400/10 hover:bg-blueberry-400/40"
      }`}
    >
      {/* pointer-events-none: otherwise dragging across the label counts
          as leaving the button, and the highlight flickers. */}
      <span className="pointer-events-none rounded-full border-2 border-ink bg-cream-card px-2 py-0.5 font-display text-[11px] font-semibold text-ink">
        {isMoveSource ? "Cancel" : entry ? "Swap" : "Move here"}
      </span>
    </button>
  ) : null;

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
    // Can't be picked up while slots are being chosen for "Fill week
    // with AI" (the two modes would fight over the same taps), while
    // another meal is already mid-move, or if its recipe is gone (there's
    // no title to say what's being moved).
    const movable = entry.recipeId
      ? { entryId: entry.id, dateISO, slot, title: entry.recipeTitle ?? "this meal" }
      : null;
    const canPickUp = movable !== null && !isSelecting && !moving;

    return (
      <div
        draggable={canPickUp}
        onDragStart={(event) => {
          if (!movable) {
            return;
          }
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", movable.title);
          // Deferred a tick: startMove re-renders this very cell (the
          // overlay appears on top of it), and changing the dragged
          // element's DOM synchronously inside dragstart makes Chrome
          // abort the drag before it begins.
          setTimeout(() => startMove(movable), 0);
        }}
        // Fires after "drop" on a successful drop (by which point the
        // move has already been handed off and this is a no-op), and on
        // its own when the meal is let go anywhere that isn't a slot —
        // which should just put it down again. Deferred for the same
        // reason as above, so it can never run ahead of that startMove.
        onDragEnd={() => setTimeout(cancelMove, 0)}
        className={`relative flex ${CELL_HEIGHT} flex-col overflow-hidden rounded-[12px_15px_11px_14px] border-2 border-ink p-2 ${cellClass} ${pastClass} ${busyClass} ${
          canPickUp ? "cursor-grab active:cursor-grabbing" : ""
        }`}
      >
        {entry.recipeId ? (
          <Link
            href={`/recipes/${entry.recipeId}`}
            // Links are draggable on their own by default (dragging one
            // drags its URL) — turned off so a drag that starts on the
            // title picks up the whole card instead.
            draggable={false}
            className={`flex flex-1 flex-col pr-6 transition hover:brightness-110 ${textClass}`}
          >
            <span className="line-clamp-3 font-display text-sm font-semibold leading-snug">
              {entry.recipeTitle}
            </span>
          </Link>
        ) : (
          <div className={`flex-1 pr-6 ${textClass}`}>
            <span className="text-xs" style={{ opacity: 0.75 }}>
              Recipe removed
            </span>
          </div>
        )}

        {/* Servings pill. The − / + buttons are 24×28px (they used to
            be bare 11px glyphs, a very small thing to hit with a thumb)
            — as big as fits: at its narrowest (the grid's 780px
            minimum) a cell has only ~70px of room inside, and the whole
            pill has to stay within that. The "serving(s)" word is
            visible wherever the cell is wide enough for it: on the
            phone layout (one full-width cell per meal) and on very wide
            screens. In between, the desktop grid's cells are too
            narrow, so it falls back to numeral-only with the word kept
            for screen readers. Border, buttons and numeral are all plain
            text-ink/border-ink (not the per-slot textClass) so the
            stepper reads the same solid black on every meal slot's
            color, matching the card's own black outline. mt-auto pins
            it to the bottom of the card instead of sitting right under
            the title. */}
        <div className="mt-auto flex w-fit items-center rounded-full border border-ink text-ink">
          <button
            type="button"
            onClick={() => adjustServings(-1)}
            disabled={entry.servings <= MIN_SERVINGS}
            aria-label="Fewer servings"
            className="flex h-7 w-6 flex-none items-center justify-center rounded-full text-base font-bold leading-none transition hover:bg-black/10 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            &minus;
          </button>
          <span className="min-w-4 px-0.5 text-center text-xs font-bold tabular-nums">
            {entry.servings}
            <span className="md:sr-only 2xl:not-sr-only">
              {" "}
              {entry.servings === 1 ? "serving" : "servings"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => adjustServings(1)}
            disabled={entry.servings >= MAX_SERVINGS}
            aria-label="More servings"
            className="flex h-7 w-6 flex-none items-center justify-center rounded-full text-base font-bold leading-none transition hover:bg-black/10 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleRemove}
          aria-label="Remove this meal"
          className={`absolute right-0.5 top-0.5 flex h-7 w-7 items-center justify-center rounded-full text-lg font-bold leading-none transition hover:bg-black/10 ${textClass}`}
          style={{ opacity: 0.75 }}
        >
          &times;
        </button>

        {/* The same pick-up as dragging the card, as a button — the only
            way to move a meal on a touch screen (HTML drag-and-drop
            doesn't exist there) or by keyboard, and what makes moving
            possible in the one-day-at-a-time phone layout at all: press
            it, switch day, tap the slot. Sits under the "x" in the strip
            the title's right padding already keeps clear. */}
        {movable && !isSelecting && (
          <button
            type="button"
            onClick={() => startMove(movable)}
            aria-label="Move this meal"
            title="Move this meal"
            className={`absolute right-0.5 top-8 flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-black/10 ${textClass}`}
            style={{ opacity: 0.75 }}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12,3 L12,21 M3,12 L21,12 M9,6 L12,3 L15,6 M9,18 L12,21 L15,18 M6,9 L3,12 L6,15 M18,9 L21,12 L18,15" />
            </svg>
          </button>
        )}

        {moveOverlay}
      </div>
    );
  }

  // One button, one door in: it opens RecipeModal, which handles picking
  // an existing recipe, typing a new one, or asking AI, all as tabs of
  // the same popup — see recipe-modal.tsx. Defaults to the "existing"
  // tab when there's a library to search, otherwise straight to "new"
  // since there's nothing to pick from yet.
  //
  // The whole box is the click target, not just the small button in its
  // middle: normally a click anywhere on it opens the same modal, and
  // once picking mode for "Fill week with AI" is on (isSelecting, turned
  // on by pressing that button — see fill-week-selection.tsx) it toggles
  // this slot's selection instead. The "+ Add meal" button stays a real
  // <button> (it's what keyboard and screen-reader users reach — the box
  // around it is a mouse/touch convenience only) and stops its own click
  // from bubbling up, so the box's handler never fires a second time on
  // top of it.
  return (
    <>
      <div
        onClick={() => {
          if (isSelecting) {
            toggleFillSelection(dateISO, slot);
          } else {
            setModalOpen(true);
          }
        }}
        className={`group relative flex ${CELL_HEIGHT} cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 p-2.5 transition ${pastClass} ${busyClass} ${
          selectedForFill
            ? "border-blueberry-400 bg-blueberry-50"
            : isSelecting
              ? "border-dashed border-blueberry-400/40 hover:border-blueberry-400 hover:bg-blueberry-50"
              : "border-dashed border-ink-faint hover:border-ink hover:bg-cream-deep"
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
          // While picking slots for "Fill week with AI" (isSelecting),
          // this button goes visually and functionally inert —
          // pointer-events-none lets the click fall straight through to
          // the box behind it instead of opening the recipe picker, so
          // tapping anywhere on the cell (including right on top of
          // "+ Add meal") always just selects it, the same as tapping
          // any other empty spot in the box.
          className={`wobble-btn relative z-10 border-2 border-ink-faint bg-cream-card px-4 py-2 font-display text-sm font-semibold text-ink-soft transition ${
            isSelecting ? "pointer-events-none opacity-50" : "group-hover:border-ink group-hover:text-ink"
          }`}
        >
          + Add meal
        </button>

        {moveOverlay}
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
