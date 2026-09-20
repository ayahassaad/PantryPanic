"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { MealSlot } from "@pantry-panic/shared";
import { fillWeekWithAi } from "./fill-week-actions";
import { useFillWeekSelection } from "./fill-week-selection";
import { MAX_SELECTED_SLOTS } from "./fill-week-constants";

interface FillWeekButtonProps {
  weekStartISO: string;
}

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

const FIELD_CLASSES =
  "rounded-xl border-2 border-ink bg-cream-card px-3 py-2 text-sm text-ink outline-none focus:border-tomato-400 placeholder:text-ink-faint";

// Client-only, so no risk of a server/browser locale mismatch on
// hydration — this only ever renders inside the popup, which starts
// closed (nothing here is part of the initial server-rendered HTML).
const dayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatSlotKey(key: string): string {
  const [dateISO, mealSlot] = key.split("_") as [string, MealSlot];
  const dayLabel = dayFormatter.format(new Date(`${dateISO}T00:00:00Z`));
  return `${dayLabel} · ${SLOT_LABELS[mealSlot] ?? mealSlot}`;
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

// Two very different jobs depending on isSelecting (see
// fill-week-selection.tsx): while off, this is a single button whose
// only purpose is to turn picking mode ON — the grid itself ignores
// clicks until then, so this really is the one door in. While on, it's
// a small Cancel/Continue toolbar instead: Cancel drops out of picking
// mode entirely, Continue opens the confirm popup (picks shown as
// removable chips, plus optional pantry + constraints) and submits.
// Unlike RecipeModal (which updates a single PlannerCell it's nested
// under), a fill can touch several cells across the grid at once, so on
// success it calls router.refresh() instead of lifting state anywhere —
// see the effect in planner-cell.tsx that picks that refresh up.
export function FillWeekButton({ weekStartISO }: FillWeekButtonProps) {
  const { selected, isSelecting, toggle, startSelecting, stopSelecting } = useFillWeekSelection();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const selectedKeys = useMemo(() => Array.from(selected), [selected]);

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || !formRef.current || selectedKeys.length === 0) return;
    setError(null);
    const formData = new FormData(formRef.current);
    formData.set("weekStartISO", weekStartISO);
    formData.set("selectedSlots", JSON.stringify(selectedKeys));

    startTransition(async () => {
      try {
        const result = await fillWeekWithAi(formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        setOpen(false);
        stopSelecting();
        router.refresh();
      } catch (err) {
        if (isRedirectError(err)) {
          throw err;
        }
        setError("Couldn't fill those meals. Try again.");
      }
    });
  }

  if (!isSelecting) {
    return (
      <button
        type="button"
        onClick={startSelecting}
        className="wobble-btn border-2 border-ink bg-blueberry-400 px-4 py-2 font-display text-sm font-semibold text-cream transition hover:brightness-105"
      >
        ✨ Fill week with AI
      </button>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="wobble-btn border-2 border-dashed border-blueberry-400 bg-cream-card px-3 py-2 font-display text-xs font-semibold text-blueberry-600">
          Tap meals below · {selectedKeys.length}/{MAX_SELECTED_SLOTS}
        </span>
        <button
          type="button"
          onClick={stopSelecting}
          className="wobble-btn border-2 border-ink bg-cream-card px-3 py-2 font-display text-sm font-semibold text-ink transition hover:bg-cream-deep"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          disabled={selectedKeys.length === 0}
          className="wobble-btn border-2 border-ink bg-blueberry-400 px-4 py-2 font-display text-sm font-semibold text-cream transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Continue{selectedKeys.length > 0 ? ` (${selectedKeys.length})` : ""}
        </button>
      </div>

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
                <h2 className="font-display text-xl font-bold text-ink">Ask AI to plan these meals</h2>
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
                  <span className="text-sm font-bold text-ink-soft">Selected meals</span>
                  <span className="text-xs font-semibold text-ink-faint">
                    {selectedKeys.length} / {MAX_SELECTED_SLOTS}
                  </span>
                </div>
                {selectedKeys.length === 0 ? (
                  <p className="text-sm text-ink-faint">
                    Nothing picked. Close this and tap a meal box on the planner to mark it.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedKeys.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          const [dateISO, mealSlot] = key.split("_") as [string, MealSlot];
                          toggle(dateISO, mealSlot);
                        }}
                        disabled={isPending}
                        className="wobble-btn flex items-center gap-1 border-2 border-ink bg-blueberry-400 px-2 py-1 text-xs font-semibold text-cream transition hover:brightness-105 disabled:opacity-60"
                      >
                        {formatSlotKey(key)}
                        <span aria-hidden>&times;</span>
                      </button>
                    ))}
                  </div>
                )}
                <span className="text-xs font-normal text-ink-faint">
                  Close this popup to pick more on the planner — up to {MAX_SELECTED_SLOTS} at a time.
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
                disabled={isPending || selectedKeys.length === 0}
              >
                {isPending ? "Planning…" : `Fill ${selectedKeys.length || ""} meal${selectedKeys.length === 1 ? "" : "s"}`.trim()}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
