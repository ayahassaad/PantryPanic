"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fillWeekWithAi } from "./fill-week-actions";

interface FillWeekButtonProps {
  weekStartISO: string;
  // Nothing to fill when every slot's already planned — same disabled
  // reasoning CopyWeekButton already uses for "nothing to copy".
  disabled: boolean;
}

const FIELD_CLASSES =
  "rounded-xl border-2 border-ink bg-cream-card px-3 py-2 text-sm text-ink outline-none focus:border-tomato-400 placeholder:text-ink-faint";

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

// Opens a small popup (pantry + constraints, both optional — leave both
// blank and Claude picks freely) whose submit hands off to
// fillWeekWithAi, which only ever touches currently-empty slots. Unlike
// RecipeModal (which updates a single PlannerCell it's nested under),
// this can fill a dozen-plus cells across the grid at once, so on
// success it calls router.refresh() instead of lifting state anywhere —
// see the effect in planner-cell.tsx that picks that refresh up.
export function FillWeekButton({ weekStartISO, disabled }: FillWeekButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

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
    if (isPending || !formRef.current) return;
    setError(null);
    const formData = new FormData(formRef.current);
    formData.set("weekStartISO", weekStartISO);

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
        setError("Couldn't fill the week. Try again.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
                <h2 className="font-display text-xl font-bold text-ink">Ask AI to plan the rest</h2>
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

            <p className="mb-4 text-sm font-semibold text-ink-soft">
              Fills in whatever&apos;s still empty this week — anything you&apos;ve already
              planned is left alone.
            </p>

            {error && (
              <p className="wobble-btn mb-4 border-2 border-ink bg-tomato-50 px-3 py-2 text-xs font-bold text-tomato-700">
                {error}
              </p>
            )}

            <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                  Optional — one ingredient per line. Leave blank for a varied week Claude
                  picks freely.
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
                disabled={isPending}
              >
                {isPending ? "Planning your week…" : "Fill empty slots"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
