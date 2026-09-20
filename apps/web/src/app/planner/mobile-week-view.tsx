"use client";

import { useState } from "react";
import type { MealSlot } from "@pantry-panic/shared";
import { PlannerCell, type PlannerEntryView, type RecipeOption } from "./planner-cell";

interface SlotStyle {
  label: string;
  cell: string;
  text: string;
}

export interface MobileDay {
  dateISO: string;
  dayLabel: string;
  dayNumber: number;
  isToday: boolean;
  entries: Partial<Record<MealSlot, PlannerEntryView | null>>;
}

interface MobileWeekViewProps {
  days: MobileDay[];
  recipes: RecipeOption[];
  hasRecipes: boolean;
  slotOrder: readonly MealSlot[];
  slotStyles: Record<MealSlot, SlotStyle>;
  defaultDateISO: string;
}

// The desktop grid needs `min-w-[780px]` to fit all 7 days side by side,
// which just means horizontal scrolling on a phone. Below the `md`
// breakpoint this renders instead: one day at a time, picked from a
// horizontally-scrollable strip of day chips, with that day's three meal
// slots stacked full-width underneath. Same PlannerCell component either
// way, so assigning/removing/undo/servings all behave identically — only
// the layout around it changes.
export function MobileWeekView({
  days,
  recipes,
  hasRecipes,
  slotOrder,
  slotStyles,
  defaultDateISO,
}: MobileWeekViewProps) {
  const [selectedDateISO, setSelectedDateISO] = useState(defaultDateISO);
  const day = days.find((d) => d.dateISO === selectedDateISO) ?? days[0];

  return (
    <div className="md:hidden">
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {days.map((d) => (
          <button
            key={d.dateISO}
            type="button"
            onClick={() => setSelectedDateISO(d.dateISO)}
            className={`flex flex-none flex-col items-center gap-0.5 rounded-xl border-2 px-3 py-1.5 transition ${
              d.dateISO === day?.dateISO
                ? "border-ink bg-tomato-400 text-cream"
                : "border-ink-faint bg-cream-card text-ink-soft"
            }`}
          >
            <span className="text-[10px] font-extrabold uppercase tracking-wide">
              {d.dayLabel}
            </span>
            <span className="font-display text-sm font-bold">{d.dayNumber}</span>
            {d.isToday && (
              <span
                className={`h-1 w-1 rounded-full ${
                  d.dateISO === day?.dateISO ? "bg-cream" : "bg-tomato-400"
                }`}
              />
            )}
          </button>
        ))}
      </div>

      {day && (
        <div className="flex flex-col gap-3">
          {slotOrder.map((slot) => {
            const style = slotStyles[slot];
            return (
              <div key={slot} className="flex flex-col gap-1.5">
                <span
                  className={`font-display text-xs font-semibold uppercase tracking-wide ${style.label}`}
                >
                  {slot}
                </span>
                <PlannerCell
                  dateISO={day.dateISO}
                  slot={slot}
                  initialEntry={day.entries[slot] ?? null}
                  recipes={recipes}
                  hasRecipes={hasRecipes}
                  cellClass={style.cell}
                  textClass={style.text}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
