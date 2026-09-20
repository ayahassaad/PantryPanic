"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { MEAL_SLOTS, type MealSlot } from "@pantry-panic/shared";
import { IngredientRows } from "../recipes/new/ingredient-rows";
import { createRecipeAndAssign, suggestRecipeAndAssign, type AssignedEntry } from "./recipe-actions";

type Tab = "new" | "ai";

interface RecipeModalProps {
  dateISO: string;
  slot: MealSlot;
  defaultTab: Tab;
  onClose: () => void;
  onCreated: (entry: AssignedEntry) => void;
}

const FIELD_CLASSES =
  "rounded-xl border-2 border-ink bg-cream-card px-3 py-2 text-sm text-ink outline-none focus:border-tomato-400";

// The planner's own way to add a recipe without leaving the meal box —
// opened from PlannerCell's empty-cell state (see openModal there). Two
// tabs share one modal rather than being two separate dialogs so
// switching between "type it in" and "ask AI" is a click, not a
// close-and-reopen. Both tabs end the same way: on success they call
// onCreated with the entry PlannerCell needs to show the cell as filled,
// and PlannerCell closes the modal — this component never redirects or
// navigates on its own.
export function RecipeModal({ dateISO, slot, defaultTab, onClose, onCreated }: RecipeModalProps) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const newFormRef = useRef<HTMLFormElement>(null);
  const aiFormRef = useRef<HTMLFormElement>(null);

  // Escape closes the modal, same as the backdrop click below — but not
  // while a request is in flight, so a stray keypress can't abandon a
  // save that's already happening server-side.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPending, onClose]);

  function submitNew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || !newFormRef.current) return;
    setError(null);
    const formData = new FormData(newFormRef.current);
    formData.set("planDate", dateISO);
    formData.set("mealSlot", slot);

    startTransition(async () => {
      const result = await createRecipeAndAssign(formData);
      if (result.error) {
        setError(result.error);
      } else if (result.entry) {
        onCreated(result.entry);
      }
    });
  }

  function submitAi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || !aiFormRef.current) return;
    setError(null);
    const formData = new FormData(aiFormRef.current);
    formData.set("planDate", dateISO);
    formData.set("mealSlot", slot);

    startTransition(async () => {
      const result = await suggestRecipeAndAssign(formData);
      if (result.error) {
        setError(result.error);
      } else if (result.entry) {
        onCreated(result.entry);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={() => !isPending && onClose()}
    >
      <div
        className="wobble-a hand-shadow max-h-[88vh] w-full max-w-md overflow-y-auto border-2 border-ink bg-cream-card p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="mb-1 font-display text-xs font-semibold uppercase tracking-widest text-tomato-400">
              Add to {slot}
            </p>
            <h2 className="font-display text-xl font-bold text-ink">
              {tab === "new" ? "Type in a recipe" : "Ask AI for a recipe"}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => !isPending && onClose()}
            aria-label="Close"
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 border-ink text-sm font-bold text-ink transition hover:bg-cream-deep disabled:opacity-40"
            disabled={isPending}
          >
            &times;
          </button>
        </div>

        <div className="mb-5 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("new")}
            disabled={isPending}
            className={`wobble-btn border-2 border-ink px-3 py-1.5 font-display text-xs font-semibold transition disabled:opacity-60 ${
              tab === "new" ? "bg-tomato-400 text-cream" : "bg-cream-deep text-ink hover:bg-cream"
            }`}
          >
            Type it in
          </button>
          <button
            type="button"
            onClick={() => setTab("ai")}
            disabled={isPending}
            className={`wobble-btn border-2 border-ink px-3 py-1.5 font-display text-xs font-semibold transition disabled:opacity-60 ${
              tab === "ai" ? "bg-blueberry-400 text-cream" : "bg-cream-deep text-ink hover:bg-cream"
            }`}
          >
            ✨ Ask AI
          </button>
        </div>

        {error && (
          <p className="wobble-btn mb-4 border-2 border-ink bg-tomato-50 px-3 py-2 text-xs font-bold text-tomato-700">
            {error}
          </p>
        )}

        {tab === "new" ? (
          <form
            ref={newFormRef}
            onSubmit={submitNew}
            className="flex flex-col gap-4"
            encType="multipart/form-data"
          >
            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
              Photo
              <input
                name="image"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={isPending}
                className="rounded-xl border-2 border-ink bg-cream-card px-3 py-2 text-sm text-ink file:mr-3 file:rounded-lg file:border-2 file:border-ink file:bg-cream-deep file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-ink hover:file:bg-cream disabled:opacity-60"
              />
              <span className="text-xs font-normal text-ink-faint">Optional. Up to 5MB.</span>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
              Title
              <input name="title" type="text" required disabled={isPending} className={FIELD_CLASSES} />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
              Description
              <textarea name="description" rows={2} disabled={isPending} className={FIELD_CLASSES} />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
              Tags
              <input
                name="tags"
                type="text"
                placeholder="quick, vegetarian, pasta"
                disabled={isPending}
                className={`${FIELD_CLASSES} placeholder:text-ink-faint`}
              />
              <span className="text-xs font-normal text-ink-faint">Comma-separated.</span>
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-ink-soft">Ingredients</span>
              <IngredientRows />
            </div>

            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
              Steps
              <textarea
                name="steps"
                rows={5}
                required
                disabled={isPending}
                placeholder={"Boil a pot of salted water.\nCook the pasta until al dente."}
                className={`${FIELD_CLASSES} placeholder:text-ink-faint`}
              />
              <span className="text-xs font-normal text-ink-faint">One step per line.</span>
            </label>

            <button
              type="submit"
              aria-busy={isPending}
              className="wobble-btn hand-shadow mt-1 w-fit bg-tomato-400 px-5 py-2.5 font-display text-sm font-semibold text-cream transition hover:brightness-105 disabled:pointer-events-none disabled:opacity-60"
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save & add to plan"}
            </button>
          </form>
        ) : (
          <form ref={aiFormRef} onSubmit={submitAi} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
              What&apos;s in your pantry?
              <textarea
                name="ingredients"
                rows={5}
                required
                disabled={isPending}
                placeholder={"chicken thighs\nrice\nsoy sauce\ngarlic"}
                className={`${FIELD_CLASSES} placeholder:text-ink-faint`}
              />
              <span className="text-xs font-normal text-ink-faint">One ingredient per line.</span>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
              Meal
              <select
                name="aiMealSlot"
                defaultValue={slot}
                disabled={isPending}
                className={FIELD_CLASSES}
              >
                {MEAL_SLOTS.map((mealSlot) => (
                  <option key={mealSlot} value={mealSlot}>
                    {mealSlot.charAt(0).toUpperCase() + mealSlot.slice(1)}
                  </option>
                ))}
              </select>
              <span className="text-xs font-normal text-ink-faint">
                Defaults to {slot} since that&apos;s the box you opened this from.
              </span>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
              Constraints
              <input
                name="constraints"
                type="text"
                placeholder="vegetarian, dairy-free, ready in 30 minutes"
                disabled={isPending}
                className={`${FIELD_CLASSES} placeholder:text-ink-faint`}
              />
              <span className="text-xs font-normal text-ink-faint">
                Optional. Your saved dietary preferences and allergies are applied automatically.
              </span>
            </label>

            <button
              type="submit"
              aria-busy={isPending}
              className="wobble-btn hand-shadow mt-1 w-fit bg-blueberry-400 px-5 py-2.5 font-display text-sm font-semibold text-cream transition hover:brightness-105 disabled:pointer-events-none disabled:opacity-60"
              disabled={isPending}
            >
              {isPending ? "Thinking of something…" : "Ask AI & add to plan"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
