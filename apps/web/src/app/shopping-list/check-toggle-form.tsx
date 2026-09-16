"use client";

import { toggleItemChecked } from "./actions";

// A checkbox that submits itself the instant it's clicked, rather than
// needing a separate "save" button — the one bit of this feature where
// that immediacy actually matters, so it's the one place in the shopping
// list that isn't a plain server-rendered form.
export function CheckToggleForm({
  itemId,
  isChecked,
  label,
}: {
  itemId: string;
  isChecked: boolean;
  label: string;
}) {
  return (
    <form
      action={toggleItemChecked}
      onChange={(event) => event.currentTarget.requestSubmit()}
    >
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="isChecked" value={String(isChecked)} />
      <input
        type="checkbox"
        defaultChecked={isChecked}
        aria-label={`Mark ${label} as ${isChecked ? "not bought" : "bought"}`}
        className="h-5 w-5 flex-none cursor-pointer rounded-md border-2 border-ink accent-leaf-400"
      />
    </form>
  );
}
