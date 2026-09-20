"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { MealSlot } from "@pantry-panic/shared";
import { fillWeekWithAi } from "./fill-week-actions";

export interface EmptySlotOption {
  dateISO: string;
  mealSlot: MealSlot;
  dayLabel: string;
  dayNumber: number;
}

interface FillWeekButtonProps {
  weekStartISO: string;
  // Every currently-empty (day, slot) pair this week — the checkbox list
  // below is built straight from this, so an already-planned meal never
  // shows up as something to overwrite.
  emptySlots: EmptySlotOption[];
}

// Keep in sync with the same-named cap in fill-week-actions.ts (enforced
// again there — this is just what keeps the UI from letting someone pick
// more than the server will accept). Chosen so a single Claude call
// reliably finishes a full batch of recipes (title + ingredients + steps
// each) without running into the response's output-token ceiling — see
// the comment on generateWeekSuggestions in lib/anthropic/suggest-recipe.ts.
const MAX_SLOTS = 8;

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

const FIELD_CLASSES =
  "rounded-xl border-2 border-ink bg-cream-card px-3 py-2 text-sm text-ink outline-none focus:border-tomato-400 placeholder:text-ink-faint";

function slotKey(slot: Pick<EmptySlotOption, "dateISO" | "mealSlot">): string {
  return `${slot.dateISO}_${slot.mealSlot}`;
}

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

// Opens a small popup: pick up to MAX_SLOTS empty meals to fill, plus
// optional pantry + constraints (leave both blank and Claude picks
// freely). Submit hands off to fillWeekWithAi, which only ever touches
// the slots actually selected here. Unlike RecipeModal (which updates a
// single PlannerCell it's nested under), this can fill several cells
// across the grid at once, so on success it calls router.refresh()
// instead of lifting state anywhere — see the effect in planner-cell.tsx
// that picks that refresh up.
export function FillWeekButton({ weekStartISO, emptySlots }: FillWeekButtonProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const disabled = emptySlots.length === 0;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) {
        setOpen(false);
      }
    }
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isPending]);

  // Recomputed fresh every time the popup opens (rather than once on
  // mount) so it reflects whatever's actually empty right now — the week
  // may have changed since the last time this was open (a meal added,
  // router.refresh() from a previous fill, etc.).
  function openPopup() {
    setError(null);
    setSelected(new Set(emptySlots.slice(0, MAX_SLOTS).map(slotKey)));
    setOpen(true);
  }

  function toggleSlot(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else if (next.size < MAX_SLOTS) {
        next.add(key);
      }
      return next;
    });
  }

  // Group emptySlots by day for the checkbox list, in the order they
  // already arrive (chronological — see the comment on emptySlots in
  // page.tsx).
  const dayGroups: Array<{ dateISO: string; dayLabel: string; dayNumber: number; slots: EmptySlotOption[] }> = [];
  for (const slot of emptySlots) {
    const lastGroup = dayGroups[dayGroups.length - 1];
    if (lastGroup && lastGroup.dateISO === slot.dateISO) {
      lastGroup.slots.push(slot);
    } else {
      dayGroups.push({ dateISO: slot.dateISO, dayLabel: slot.dayLabel, dayNumber: slot.dayNumber, slots: [slot] });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || !formRef.current || selected.size === 0) return;
    setError(null);
    const formData = new FormData(formRef.current);
    formData.set("weekStartISO", weekStartISO);
    formData.set("selectedSlots", JSON.stringify(Array.from(selected)));

    startTransition(async () => {
      try {
        const result = await fillWeekWithAi(formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        setOpen(false);
        router.refresh();
      } catch (err) {
        if (isRedirectError(err)) {
          throw err;
        }
        setError("Couldn't fill those meals. Try again.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openPopup}
        disabled={disabled}
        className="wobble-btn border-2 border-ink bg-blueberry-400 px-4 py-2 font-display text-sm font-semibold text-cream transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        ✨ Fill week with AI
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => !isPending && setOpen(false)}
        >
          <div
            className="wobble-a hand-shadow max-h-[88vh] w-full max-w-md overflow-y-auto border-2 border-ink bg-cream-card p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="mb-1 font-display text-xs font-semibold uppercase tracking-widest text-blueberry-400">
                  Fill week
                </p>
                <h2 className="font-display text-xl font-bold text-ink">Ask AI to plan some meals</h2>
              </div>
              <button
                type="button"
                onClick={() => !isPending && setOpen(false)}
                aria-label="Close"
                className="flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 border-ink text-sm font-bold text-ink transition hover:bg-cream-deep disabled:opacity-40"
                disabled={isPending}
              >
                &times;
              </button>
            </div>

            {error && (
              <p className="wobble-btn mb-4 border-2 border-ink bg-tomato-50 px-3 py-2 text-xs font-bold text-tomato-700">
                {error}
              </p>
            )}

            <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-ink-soft">Which meals?</span>
                  <span className="text-xs font-semibold text-ink-faint">
                    {selected.size} / {MAX_SLOTS} selected
                  </span>
                </div>
                <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto rounded-xl border-2 border-ink-faint p-2.5">
                  {dayGroups.map((day) => (
                    <div key={day.dateISO} className="flex items-center gap-2">
                      <span className="w-14 flex-none text-xs font-bold text-ink-soft">
                        {day.dayLabel} {day.dayNumber}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {day.slots.map((slot) => {
                          const key = slotKey(slot);
                          const isSelected = selected.has(key);
                          const atCap = !isSelected && selected.size >= MAX_SLOTS;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => toggleSlot(key)}
                              disabled={isPending || atCap}
                              aria-pressed={isSelected}
                              className={`wobble-btn border-2 px-2 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                isSelected
                                  ? "border-ink bg-blueberry-400 text-cream"
                                  : "border-ink-faint bg-cream-card text-ink-soft hover:border-ink"
                              }`}
                            >
                              {SLOT_LABELS[slot.mealSlot]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <span className="text-xs font-normal text-ink-faint">
                  Up to {MAX_SLOTS} at a time. Anything you don&apos;t pick stays as is.
                </span>
              </div>

              <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
                What&apos;s in your pantry?
                <textarea
                  name="ingredients"
                  rows={4}
                  disabled={isPending}
                  placeholder={"chicken thighs\nrice\nsoy sauce\ngarlic"}
                  className={FIELD_CLASSES}
                />
                <span className="text-xs font-normal text-ink-faint">
                  Optional — one ingredient per line. Leave blank for a varied pick Claude makes
                  freely.
                </span>
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
                Constraints
                <input
                  name="constraints"
                  type="text"
                  placeholder="vegetarian, quick weeknights, no repeats"
                  disabled={isPending}
                  className={FIELD_CLASSES}
                />
                <span className="text-xs font-normal text-ink-faint">
                  Optional. Your saved dietary preferences and allergies are applied
                  automatically.
                </span>
              </label>

              <button
                type="submit"
                aria-busy={isPending}
                className="wobble-btn hand-shadow mt-1 w-fit bg-blueberry-400 px-5 py-2.5 font-display text-sm font-semibold text-cream transition hover:brightness-105 disabled:pointer-events-none disabled:opacity-60"
                disabled={isPending || selected.size === 0}
              >
                {isPending
                  ? "Planning…"
                  : `Fill ${selected.size || ""} ${selected.size === 1 ? "meal" : "meals"}`.trim()}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
