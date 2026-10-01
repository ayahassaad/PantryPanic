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
  isPast: boolean;
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
                : `border-ink-faint bg-cream-card text-ink-soft ${d.isPast ? "opacity-50" : ""}`
            }`}
          >
            <span className="text-[10px] font-extrabold uppercase tracking-wide">
              {d.dayLabel}
            </span>
            {/* Today gets the same citrus circle around its date as the
                desktop grid's header — it used to be a small dot under
                the number, which would now be lost among the meal dots
                below. */}
            <span
              className={`inline-flex h-6 w-6 items-center justify-center font-display text-sm font-bold ${
                d.isToday ? "rounded-full bg-citrus-400 text-ink" : ""
              }`}
            >
              {d.dayNumber}
            </span>
            {/* One dot per meal slot, filled in that slot's color once
                something's planned there — with only one day on screen
                at a time, this is the only way to see which other days
                still need planning without tapping through all seven. */}
            <span className="flex gap-1">
              {slotOrder.map((slot) => (
                <span
                  key={slot}
                  className={`h-2 w-2 rounded-full border ${
                    d.entries[slot]
                      ? `border-ink ${slotStyles[slot].cell}`
                      : d.dateISO === day?.dateISO
                        ? "border-cream/70"
                        : "border-ink-faint"
                  }`}
                />
              ))}
            </span>
            <span className="sr-only">
              {slotOrder.filter((slot) => d.entries[slot]).length} of {slotOrder.length} meals planned
            </span>
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
                  isPast={day.isPast}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
