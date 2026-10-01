"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { MEAL_SLOTS, type MealSlot } from "@pantry-panic/shared";
import { addDays, toISODate } from "@/lib/week";
import { addRecipeToPlanner } from "./actions";

// A Next.js redirect() (e.g. "not logged in any more") works by throwing
// a special error with a digest starting "NEXT_REDIRECT" — same reasoning
// as the copy in recipe-grid.tsx: let it through rather than swallowing
// it as a normal error.
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

// How far ahead a recipe can be planned from here. Two weeks covers
// "this week and next"; anything further out is what the planner's own
// week arrows are for.
const DAYS_AHEAD = 14;

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

interface DayOption {
  dateISO: string;
  label: string;
}

// Today onward, by the UTC date — the same "today" the planner and the
// dashboard use, so the first option here is always the column the
// planner circles. Only ever called once the dialog is opened (never
// during server rendering), so there's no hydration mismatch to worry
// about from reading the clock.
function upcomingDays(): DayOption[] {
  const today = new Date(`${toISODate(new Date())}T00:00:00Z`);
  return Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const day = addDays(today, i);
    const formatted = dayFormatter.format(day);
    return {
      dateISO: toISODate(day),
      label: i === 0 ? `Today · ${formatted}` : i === 1 ? `Tomorrow · ${formatted}` : formatted,
    };
  });
}

const FIELD_CLASSES =
  "rounded-xl border-2 border-ink bg-cream-card px-3 py-2 text-sm text-ink outline-none focus:border-tomato-400";

interface AddToPlannerButtonProps {
  recipeId: string;
  recipeTitle: string;
  // "card": the small underlined text link that sits beside Edit/Delete
  // on a recipe card. "page": the full button on the recipe's own page.
  variant: "card" | "page";
}

// Puts a recipe into the meal plan without leaving the recipe: pick a
// day and a meal, done. Before this the only way in was from the other
// side — open the planner, find the slot, then find the recipe again in
// its picker.
//
// If the chosen slot already has something in it, nothing is overwritten
// until that's been said out loud and confirmed (see the `conflictTitle`
// step) — the planner's own picker replaces silently, but there you can
// see the slot you're replacing; here you can't.
export function AddToPlannerButton({ recipeId, recipeTitle, variant }: AddToPlannerButtonProps) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<DayOption[]>([]);
  const [dateISO, setDateISO] = useState("");
  const [slot, setSlot] = useState<MealSlot>("dinner");
  const [error, setError] = useState<string | null>(null);
  const [conflictTitle, setConflictTitle] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    const options = upcomingDays();
    setDays(options);
    setDateISO(options[0]?.dateISO ?? "");
    setSlot("dinner");
    setError(null);
    setConflictTitle(null);
    setAdded(false);
    setOpen(true);
  }

  // Escape closes the dialog, same as clicking the backdrop — but not
  // mid-save, so a stray keypress can't hide a request that's already on
  // its way.
  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isPending]);

  function submit(replace: boolean) {
    if (!dateISO || isPending) {
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const result = await addRecipeToPlanner(recipeId, dateISO, slot, replace);
        if (result.conflictTitle) {
          setConflictTitle(result.conflictTitle);
        } else if (result.error) {
          setError(result.error);
        } else {
          setConflictTitle(null);
          setAdded(true);
        }
      } catch (caught) {
        if (isRedirectError(caught)) {
          throw caught;
        }
        setError("Couldn't add that to the planner.");
      }
    });
  }

  const dayLabel = days.find((day) => day.dateISO === dateISO)?.label ?? "";

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={
          variant === "page"
            ? "wobble-btn hand-shadow bg-leaf-400 px-4 py-2 font-display text-sm font-semibold text-ink transition hover:brightness-105"
            : "text-xs font-bold text-ink-soft underline underline-offset-2 transition hover:text-ink"
        }
      >
        + Add to planner
      </button>

      {/* Rendered into <body>, not in place: a recipe card is tilted with
          a CSS transform (and clips its overflow), and a `position:
          fixed` element inside a transformed ancestor is positioned —
          and clipped — relative to that ancestor instead of the screen.
          A portal sidesteps both. */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
            onClick={() => !isPending && setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Add ${recipeTitle} to the planner`}
              className="wobble-a hand-shadow w-full max-w-sm border-2 border-ink bg-cream-card p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="mb-1 font-display text-xs font-semibold uppercase tracking-widest text-leaf-600">
                    Add to planner
                  </p>
                  <h2 className="line-clamp-2 font-display text-xl font-bold text-ink">
                    {recipeTitle}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  disabled={isPending}
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 border-ink text-sm font-bold text-ink transition hover:bg-cream-deep disabled:opacity-40"
                >
                  &times;
                </button>
              </div>

              {added ? (
                <div className="flex flex-col gap-4">
                  <p className="text-sm font-bold text-ink">
                    Added to {slot} on {dayLabel}.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/planner?week=${dateISO}`}
                      className="wobble-btn border-2 border-ink bg-leaf-400 px-4 py-2 font-display text-sm font-semibold text-ink transition hover:brightness-105"
                    >
                      View planner
                    </Link>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="wobble-btn border-2 border-ink bg-cream-deep px-4 py-2 font-display text-sm font-semibold text-ink transition hover:bg-cream"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
                    Day
                    <select
                      value={dateISO}
                      onChange={(event) => {
                        setDateISO(event.target.value);
                        setConflictTitle(null);
                      }}
                      disabled={isPending}
                      className={FIELD_CLASSES}
                    >
                      {days.map((day) => (
                        <option key={day.dateISO} value={day.dateISO}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
                    Meal
                    <div className="flex flex-wrap gap-2">
                      {MEAL_SLOTS.map((mealSlot) => (
                        <button
                          key={mealSlot}
                          type="button"
                          onClick={() => {
                            setSlot(mealSlot);
                            setConflictTitle(null);
                          }}
                          aria-pressed={slot === mealSlot}
                          disabled={isPending}
                          className={`wobble-btn border-2 border-ink px-3 py-1.5 font-display text-xs font-semibold capitalize transition disabled:opacity-60 ${
                            slot === mealSlot
                              ? "bg-tomato-400 text-cream"
                              : "bg-cream-deep text-ink hover:bg-cream"
                          }`}
                        >
                          {mealSlot}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <p className="wobble-btn border-2 border-ink bg-tomato-50 px-3 py-2 text-xs font-bold text-tomato-700">
                      {error}
                    </p>
                  )}

                  {conflictTitle ? (
                    <div className="wobble-btn flex flex-col gap-3 border-2 border-ink bg-citrus-50 px-3 py-3">
                      <p className="text-sm font-bold text-ink">
                        That slot already has “{conflictTitle}”. Replace it?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => submit(true)}
                          disabled={isPending}
                          className="wobble-btn border-2 border-ink bg-tomato-400 px-3 py-1.5 font-display text-xs font-semibold text-cream transition hover:brightness-105 disabled:opacity-60"
                        >
                          {isPending ? "Replacing…" : "Replace"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConflictTitle(null)}
                          disabled={isPending}
                          className="wobble-btn border-2 border-ink bg-cream-deep px-3 py-1.5 font-display text-xs font-semibold text-ink transition hover:bg-cream disabled:opacity-60"
                        >
                          Pick another slot
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => submit(false)}
                      disabled={isPending}
                      className="wobble-btn hand-shadow w-fit bg-leaf-400 px-5 py-2.5 font-display text-sm font-semibold text-ink transition hover:brightness-105 disabled:opacity-60"
                    >
                      {isPending ? "Adding…" : "Add to planner"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
