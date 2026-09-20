"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { copyWeekForward } from "./actions";

// A Next.js redirect() (e.g. "not logged in any more") works by throwing
// a special error with a digest starting "NEXT_REDIRECT" — Next's own
// runtime catches that to perform the navigation. If the catch block
// below swallowed it like a normal error, the redirect would silently
// never happen, so it's explicitly let through instead.
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

interface CopyWeekButtonProps {
  weekStartISO: string;
  nextWeekISO: string;
  disabled: boolean;
}

// Duplicates the currently-viewed week into next week, then jumps there
// so the result is visible right away. Confirms first since it can
// silently overwrite meals already planned for next week (copyWeekForward
// upserts on the same slot).
export function CopyWeekButton({ weekStartISO, nextWeekISO, disabled }: CopyWeekButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleClick() {
    setError(null);

    if (
      !window.confirm(
        "Copy this week's meals to next week? This will overwrite anything already planned there.",
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await copyWeekForward(weekStartISO);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.push(`/planner?week=${nextWeekISO}`);
      } catch (err) {
        if (isRedirectError(err)) {
          throw err;
        }
        setError("Couldn't copy that week.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isPending}
        className="wobble-btn border-2 border-ink bg-cream-card px-4 py-2 font-display text-sm font-semibold text-ink transition hover:bg-cream-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Copying…" : "Copy → next week"}
      </button>
      {error && <p className="max-w-[180px] text-right text-[11px] font-bold text-tomato-600">{error}</p>}
    </div>
  );
}
