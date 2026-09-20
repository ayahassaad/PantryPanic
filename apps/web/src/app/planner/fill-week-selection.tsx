"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MealSlot } from "@pantry-panic/shared";
import { MAX_SELECTED_SLOTS } from "./fill-week-constants";

export function slotKey(dateISO: string, mealSlot: MealSlot): string {
  return `${dateISO}_${mealSlot}`;
}

interface FillWeekSelectionContextValue {
  selected: Set<string>;
  isSelected: (dateISO: string, mealSlot: MealSlot) => boolean;
  toggle: (dateISO: string, mealSlot: MealSlot) => void;
  clear: () => void;
  max: number;
}

const FillWeekSelectionContext = createContext<FillWeekSelectionContextValue | null>(null);

// Which empty meals are picked for "Fill week with AI" — lifted above
// both the meal grid (each PlannerCell toggles itself on click) and
// FillWeekButton (which reads the picks and submits them), since they're
// siblings under page.tsx rather than parent/child. A context avoids
// prop-drilling a toggle callback and a growing Set down through every
// cell in the grid and the mobile day view alike.
export function FillWeekSelectionProvider({
  weekStartISO,
  children,
}: {
  weekStartISO: string;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Switching weeks (Prev/Next/Today) means every previously-selected
  // (date, slot) key belongs to cells that no longer exist on screen —
  // drop them rather than carry an invisible, confusing count across a
  // week change. (The server action would ignore stale out-of-range
  // picks anyway, but the button's "N selected" label shouldn't lie
  // about what's actually still checked.)
  useEffect(() => {
    setSelected(new Set());
  }, [weekStartISO]);

  const value = useMemo<FillWeekSelectionContextValue>(
    () => ({
      selected,
      isSelected: (dateISO, mealSlot) => selected.has(slotKey(dateISO, mealSlot)),
      toggle: (dateISO, mealSlot) => {
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
      clear: () => setSelected(new Set()),
      max: MAX_SELECTED_SLOTS,
    }),
    [selected],
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
