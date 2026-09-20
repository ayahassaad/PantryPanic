"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "./actions";

// A plain confirm() dialog here is just normal app behavior (not
// anything to do with browser-automation confirms) — same reasoning as
// DeleteRecipeButton, just with a heavier warning since this one takes
// everything with it, not one recipe.
export function DeleteAccountButton() {
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function handleClick() {
    if (
      !window.confirm(
        "Delete your account? This permanently removes your profile, recipes, meal plans, and shopping lists. This can't be undone.",
      )
    ) {
      return;
    }
    setFailed(false);
    startTransition(() => {
      // deleteAccount always ends in a redirect() — either to /login on
      // success, or back to this page with ?error= on failure — and
      // redirect() works by throwing, which is why the "real" failure
      // case here is any error that ISN'T that throw.
      deleteAccount().catch((error: unknown) => {
        const digest = (error as { digest?: string } | null)?.digest;
        if (digest?.startsWith("NEXT_REDIRECT")) {
          throw error;
        }
        setFailed(true);
      });
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="border-b-2 border-dashed border-tomato-400 text-sm font-bold text-tomato-600 transition hover:text-tomato-700 disabled:opacity-60"
      >
        {isPending ? "Deleting…" : "Delete my account"}
      </button>
      {failed && (
        <span className="text-xs font-bold text-tomato-600">
          Couldn&apos;t delete your account.
        </span>
      )}
    </div>
  );
}
