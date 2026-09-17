"use client";

import { useState, useTransition } from "react";

interface DeleteRecipeButtonProps {
  recipeId: string;
  deleteRecipe: (recipeId: string) => Promise<void>;
}

// A plain confirm() dialog here is just normal app behavior (not
// anything to do with browser-automation confirms) — it's the standard,
// zero-dependency way to make a destructive action ask "are you sure?"
export function DeleteRecipeButton({ recipeId, deleteRecipe }: DeleteRecipeButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function handleClick() {
    if (!window.confirm("Delete this recipe? This can't be undone.")) {
      return;
    }
    setFailed(false);
    startTransition(() => {
      // deleteRecipe always ends in a redirect() — either back to
      // /recipes on success, or to this page with ?error= on failure —
      // and redirect() works by throwing, which is why the "real"
      // failure case here is any error that ISN'T that throw.
      deleteRecipe(recipeId).catch((error: unknown) => {
        const digest = (error as { digest?: string } | null)?.digest;
        if (digest?.startsWith("NEXT_REDIRECT")) {
          throw error;
        }
        setFailed(true);
      });
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="border-b-2 border-dashed border-tomato-400 text-sm font-bold text-tomato-600 transition hover:text-tomato-700 disabled:opacity-60"
      >
        {isPending ? "Deleting…" : "Delete"}
      </button>
      {failed && (
        <span className="text-xs font-bold text-tomato-600">Couldn&apos;t delete that.</span>
      )}
    </div>
  );
}
