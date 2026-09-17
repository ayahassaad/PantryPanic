"use client";

import { useState, useTransition } from "react";
import { removeItem, toggleItemChecked } from "./actions";

// A Next.js redirect() (e.g. "not logged in any more") works by throwing
// a special error with a digest starting "NEXT_REDIRECT" — Next's own
// runtime catches that to perform the navigation. If our catch blocks
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

interface ShoppingListItemRowProps {
  itemId: string;
  name: string;
  amount: string | null;
  isManual: boolean;
  initialChecked: boolean;
}

// Owns the whole row (checkbox, label, and the remove button) rather
// than just the checkbox, so both checking an item off *and* removing
// it update on screen the instant you click — same pattern as the
// recipe favorite star — instead of waiting on the round trip to
// Supabase that used to be the only thing that made the label's
// strikethrough or the row's disappearance actually show up.
export function ShoppingListItemRow({
  itemId,
  name,
  amount,
  isManual,
  initialChecked,
}: ShoppingListItemRowProps) {
  const [isChecked, setIsChecked] = useState(initialChecked);
  const [isRemoved, setIsRemoved] = useState(false);
  const [, startTransition] = useTransition();

  function handleCheckedChange() {
    const wasChecked = isChecked;
    setIsChecked(!wasChecked);

    startTransition(async () => {
      try {
        await toggleItemChecked(itemId, wasChecked);
      } catch (error) {
        if (isRedirectError(error)) {
          throw error;
        }
        setIsChecked(wasChecked);
      }
    });
  }

  function handleRemove() {
    setIsRemoved(true);

    startTransition(async () => {
      try {
        await removeItem(itemId);
      } catch (error) {
        if (isRedirectError(error)) {
          throw error;
        }
        // Couldn't actually delete it — bring it back rather than leave
        // the list quietly wrong.
        setIsRemoved(false);
      }
    });
  }

  if (isRemoved) {
    return null;
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border-2 border-ink bg-cream-card px-3.5 py-2.5">
      <input
        type="checkbox"
        checked={isChecked}
        onChange={handleCheckedChange}
        aria-label={`Mark ${name} as ${isChecked ? "not bought" : "bought"}`}
        className="h-5 w-5 flex-none cursor-pointer rounded-md border-2 border-ink accent-leaf-400"
      />
      <span
        className={`flex-1 text-sm font-bold ${
          isChecked ? "text-ink-faint line-through" : "text-ink"
        }`}
      >
        {[amount, name].filter(Boolean).join(" ")}
        {isManual && (
          <span className="ml-2 rounded-full bg-cream-deep px-2 py-0.5 text-[11px] font-extrabold text-ink-soft">
            added by you
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={handleRemove}
        className="text-xs font-bold text-ink-faint underline hover:text-ink-soft"
      >
        Remove
      </button>
    </li>
  );
}
