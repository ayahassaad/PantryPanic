"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setItemChecked } from "@/app/shopping-list/actions";

// A Next.js redirect() (e.g. "not logged in any more") works by throwing
// a special error with a digest starting "NEXT_REDIRECT" — same reasoning
// as the copy in shopping-list/check-toggle-form.tsx: let it through
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

export interface NotepadItem {
  id: string;
  name: string;
  // Quantity + unit already formatted for display ("2 cups"), or null.
  amount: string | null;
  isChecked: boolean;
}

// The shopping list on the fridge's notepad — the same rows, from the
// same table, as the shopping list page, so ticking something off in
// either place shows up in the other the next time it's opened.
//
// Ticking is optimistic, same pattern as the shopping list page's own
// rows: the box and the strike-through flip the instant you click, the
// save happens in the background, and a failed save flips it back.
export function ShoppingNotepadList({ items }: { items: NotepadItem[] }) {
  // Only the items whose box has been clicked this visit — everything
  // else reads its state straight from the props, so a fresh set of items
  // from the server is never shadowed by stale local state.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  const isChecked = (item: NotepadItem) => overrides[item.id] ?? item.isChecked;
  const left = items.filter((item) => !isChecked(item)).length;

  function toggle(item: NotepadItem) {
    const next = !isChecked(item);
    setOverrides((current) => ({ ...current, [item.id]: next }));

    startTransition(async () => {
      try {
        await setItemChecked(item.id, next);
      } catch (error) {
        if (isRedirectError(error)) {
          throw error;
        }
        // Couldn't save it — put the box back rather than leave the
        // notepad claiming something the real list doesn't say.
        setOverrides((current) => ({ ...current, [item.id]: !next }));
      }
    });
  }

  return (
    <>
      <h2 className="mb-3 flex items-baseline justify-between gap-3 font-display text-[28px] font-bold leading-none text-ink">
        <Link href="/shopping-list" className="hover:underline">
          Shopping
        </Link>
        <small className="font-sans text-[13px] font-extrabold text-ink-soft">
          {items.length === 0 ? "empty" : left === 0 ? "all done" : `${left} left`}
        </small>
      </h2>

      {items.length === 0 ? (
        <p className="py-2 text-sm font-bold text-ink-soft">
          Nothing to buy yet. It fills itself from your meal plan.
        </p>
      ) : (
        // Every item, in the shopping list page's order, in a pad that
        // scrolls once it's taller than a handful of rows — so something
        // ticked off over there is always findable here, crossed out in
        // its usual place, rather than dropping off the end of a
        // "first five" preview.
        <ul className="notepad-lines max-h-[231px] overflow-y-auto pr-1 2xl:max-h-[308px]">
          {items.map((item) => {
            const checked = isChecked(item);
            return (
              <li key={item.id}>
                <label
                  className={`flex h-[38.5px] cursor-pointer items-center gap-2.5 text-[15px] font-bold xl:text-base ${
                    checked ? "text-ink-faint line-through" : "text-ink"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(item)}
                    aria-label={`Mark ${item.name} as ${checked ? "not bought" : "bought"}`}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border-[2.5px] border-ink text-[10px] leading-none no-underline peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-1 ${
                      checked ? "bg-leaf-400 text-ink" : "bg-cream-card text-transparent"
                    }`}
                  >
                    &#10003;
                  </span>
                  <span className="truncate">{[item.amount, item.name].filter(Boolean).join(" ")}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/shopping-list"
        className="mt-3 inline-block border-b-2 border-dashed border-ink-soft text-[13px] font-extrabold text-ink-soft transition hover:text-ink"
      >
        Open the full list &rarr;
      </Link>
    </>
  );
}
