"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { MealSlot } from "@pantry-panic/shared";
import { moveMealPlanEntry } from "./actions";
import { slotKey, useFillWeekSelection } from "./fill-week-selection";

// A Next.js redirect() (e.g. "not logged in any more") works by throwing
// a special error with a digest starting "NEXT_REDIRECT" — same reasoning
// as the copy in planner-cell.tsx and recipe-modal.tsx: let it through
// rather than swallowing it as a normal error.
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export interface MovingMeal {
  entryId: string;
  dateISO: string;
  slot: MealSlot;
  title: string;
}

interface MoveMealContextValue {
  // The meal currently "picked up" — set by dragging a filled cell or
  // pressing its Move button, cleared by dropping it somewhere or
  // cancelling. While it's set, every cell shows a drop target.
  moving: MovingMeal | null;
  // Whether this cell is one of the two a move is currently being saved
  // for (so it can show itself as busy until the page refreshes).
  isBusy: (dateISO: string, slot: MealSlot) => boolean;
  error: string | null;
  startMove: (meal: MovingMeal) => void;
  cancelMove: () => void;
  dropOn: (dateISO: string, slot: MealSlot) => void;
  dismissError: () => void;
}

const MoveMealContext = createContext<MoveMealContextValue | null>(null);

// Which meal is being moved, shared across every PlannerCell (the source
// and all its possible destinations) and the banner — same reason
// FillWeekSelectionProvider is a context: they're siblings under
// page.tsx, in both the desktop grid and the mobile day view, not
// parent/child.
//
// Unlike add/remove/servings (each handled optimistically inside the one
// cell it concerns), a move touches two cells at once, neither of which
// knows about the other — so, like "Fill week", it works the ordinary
// Next.js way: write to the DB, then router.refresh(), and each cell
// picks its new contents up from the fresh props (see the useEffect on
// initialEntry in planner-cell.tsx).
export function MoveMealProvider({
  weekStartISO,
  children,
}: {
  weekStartISO: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { isSelecting } = useFillWeekSelection();
  const [moving, setMoving] = useState<MovingMeal | null>(null);
  const [busyKeys, setBusyKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // A picked-up meal belongs to cells that are no longer on screen once
  // the week changes, and picking slots for "Fill week with AI" uses the
  // very same taps — drop the move in both cases rather than leave two
  // modes fighting over one click.
  useEffect(() => {
    setMoving(null);
    setError(null);
  }, [weekStartISO]);
  useEffect(() => {
    if (isSelecting) {
      setMoving(null);
    }
  }, [isSelecting]);

  // The busy marker outlives the server action by design: it's only
  // cleared once the transition (which includes the router.refresh()
  // below) has settled, i.e. once the cells actually show the result.
  useEffect(() => {
    if (!isPending) {
      setBusyKeys([]);
    }
  }, [isPending]);

  useEffect(() => {
    if (!moving) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMoving(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moving]);

  const value = useMemo<MoveMealContextValue>(
    () => ({
      moving,
      isBusy: (dateISO, slot) => busyKeys.includes(slotKey(dateISO, slot)),
      error,
      startMove: (meal) => {
        setError(null);
        setMoving(meal);
      },
      cancelMove: () => setMoving(null),
      dropOn: (dateISO, slot) => {
        if (!moving) {
          return;
        }
        const meal = moving;
        setMoving(null);
        // Dropped back where it came from — nothing to do.
        if (meal.dateISO === dateISO && meal.slot === slot) {
          return;
        }
        setBusyKeys([slotKey(meal.dateISO, meal.slot), slotKey(dateISO, slot)]);
        startTransition(async () => {
          try {
            const result = await moveMealPlanEntry(meal.entryId, dateISO, slot);
            if (result.error) {
              setError(result.error);
              return;
            }
            router.refresh();
          } catch (caught) {
            if (isRedirectError(caught)) {
              throw caught;
            }
            setError("Couldn't move that meal.");
          }
        });
      },
      dismissError: () => setError(null),
    }),
    [moving, busyKeys, error, router],
  );

  return <MoveMealContext.Provider value={value}>{children}</MoveMealContext.Provider>;
}

export function useMoveMeal(): MoveMealContextValue {
  const context = useContext(MoveMealContext);
  if (!context) {
    throw new Error("useMoveMeal must be used within a MoveMealProvider");
  }
  return context;
}

// Says what's going on while a meal is picked up (and offers the way
// out), or why a move didn't go through. Floats above the page — fixed,
// not inline — on purpose: an inline banner appearing the moment a drag
// starts would push the whole grid down, sliding every drop target out
// from under the cursor mid-drag. bottom-20 on mobile clears the fixed
// tab bar (see site-nav.tsx).
export function MoveMealBanner() {
  const { moving, error, cancelMove, dismissError } = useMoveMeal();

  if (!moving && !error) {
    return null;
  }

  return (
    <div
      role="status"
      className="wobble-btn hand-shadow fixed bottom-20 left-1/2 z-40 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 border-2 border-ink bg-cream-card px-4 py-2.5 text-sm font-bold text-ink sm:bottom-6"
    >
      {moving ? (
        <span className="min-w-0">
          Moving <span className="font-display">“{moving.title}”</span> — pick a slot to drop it in.
          A filled one swaps.
        </span>
      ) : (
        <span className="min-w-0 text-tomato-700">{error}</span>
      )}
      <button
        type="button"
        onClick={moving ? cancelMove : dismissError}
        className="flex-none rounded-lg border-2 border-ink bg-cream-deep px-2.5 py-0.5 font-display text-xs font-semibold text-ink transition hover:bg-cream"
      >
        {moving ? "Cancel" : "OK"}
      </button>
    </div>
  );
}
