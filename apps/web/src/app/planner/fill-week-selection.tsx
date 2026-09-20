"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MealSlot } from "@pantry-panic/shared";
import { MAX_SELECTED_SLOTS } from "./fill-week-constants";

export function slotKey(dateISO: string, mealSlot: MealSlot): string {
  return `${dateISO}_${mealSlot}`;
}

interface FillWeekSelectionContextValue {
  selected: Set<string>;
  // Whether tapping a meal box picks it right now. Off by default — the
  // grid behaves exactly like it did before this feature existed (only
  // "+ Add meal" does anything) until "Fill week with AI" is pressed,
  // which is the one thing that turns picking on. Stops an ordinary
  // click while browsing the planner from ever being mistaken for a
  // selection.
  isSelecting: boolean;
  isSelected: (dateISO: string, mealSlot: MealSlot) => boolean;
  toggle: (dateISO: string, mealSlot: MealSlot) => void;
  startSelecting: () => void;
  stopSelecting: () => void;
  max: number;
}

const FillWeekSelectionContext = createContext<FillWeekSelectionContextValue | null>(null);

// Which empty meals are picked for "Fill week with AI", and whether
// picking mode is even on — lifted above both the meal grid (each
// PlannerCell toggles itself on click, but only while isSelecting) and
// FillWeekButton (which turns isSelecting on/off and reads the picks),
// since they're siblings under page.tsx rather than parent/child. A
// context avoids prop-drilling a toggle callback and a growing Set down
// through every cell in the grid and the mobile day view alike.
export function FillWeekSelectionProvider({
  weekStartISO,
  children,
}: {
  weekStartISO: string;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);

  // Switching weeks (Prev/Next/Today) means every previously-selected
  // (date, slot) key belongs to cells that no longer exist on screen, and
  // picking mode shouldn't silently carry over onto a week the user
  // didn't explicitly start selecting on — drop both rather than leave
  // an invisible, confusing state behind. (The server action would
  // ignore stale out-of-range picks anyway, but the UI shouldn't lie
  // about what's actually still checked or still active.)
  useEffect(() => {
    setSelected(new Set());
    setIsSelecting(false);
  }, [weekStartISO]);

  const value = useMemo<FillWeekSelectionContextValue>(
    () => ({
      selected,
      isSelecting,
      isSelected: (dateISO, mealSlot) => selected.has(slotKey(dateISO, mealSlot)),
      toggle: (dateISO, mealSlot) => {
        // Picking is only live once "Fill week with AI" has been
        // pressed — see the comment on isSelecting above.
        if (!isSelecting) return;
        setSelected((current) => {
          const key = slotKey(dateISO, mealSlot);
          const next = new Set(current);
          if (next.has(key)) {
            next.delete(key);
          } else if (next.size < MAX_SELECTED_SLOTS) {
            next.add(key);
          }
          // Silently ignores an attempt to add a 9th — the cell just
          // doesn't light up. FillWeekButton's "X / 8" counter is what
          // explains why, rather than this throwing or erroring.
          return next;
        });
      },
      startSelecting: () => {
        setSelected(new Set());
        setIsSelecting(true);
      },
      stopSelecting: () => {
        setIsSelecting(false);
        setSelected(new Set());
      },
      max: MAX_SELECTED_SLOTS,
    }),
    [selected, isSelecting],
  );

  return <FillWeekSelectionContext.Provider value={value}>{children}</FillWeekSelectionContext.Provider>;
}

export function useFillWeekSelection(): FillWeekSelectionContextValue {
  const context = useContext(FillWeekSelectionContext);
  if (!context) {
    throw new Error("useFillWeekSelection must be used within a FillWeekSelectionProvider");
  }
  return context;
}
