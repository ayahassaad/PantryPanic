"use client";

import { useEffect, useState } from "react";

// Pulled out as its own client component so the page itself can stay a
// server component. A Claude call here takes several seconds; without any
// feedback the button just sits there looking dead, which is exactly what
// happened: no indication anything was happening, so it got clicked
// repeatedly and made several duplicate recipes.
//
// This uses plain useState rather than react-dom's useFormStatus because
// this app is pinned to react-dom@18.3.1, which doesn't export that hook
// (it needs React 19) — calling it threw "Cannot read properties of
// undefined (reading 'call')" at runtime.
//
// Important: this deliberately never sets the real `disabled` attribute.
// Flipping a submit button to disabled inside its own click handler can
// make the browser cancel the form submission entirely (observed here —
// the POST never even reached the server), because by the time the
// browser goes to submit, the button already looks disabled. Pointer-events
// + aria-disabled fake the same look without touching real disabled state,
// and the `pending` check in onClick still blocks a second click from
// double-submitting.
//
// hasError flips back to true when the server action redirects back here
// with ?error=..., which resets the pending state — otherwise a failed
// submission would leave the button stuck saying "Thinking of something…"
// forever, since Next's soft navigation back to this same route doesn't
// remount this component.
export function SubmitButton({ hasError }: { hasError: boolean }) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (hasError) setPending(false);
  }, [hasError]);

  return (
    <button
      type="submit"
      aria-disabled={pending}
      aria-busy={pending}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        // Only flip to "pending" if the form is actually about to submit —
        // otherwise a blocked native validation (e.g. the required
        // ingredients field being empty) would leave the button stuck
        // looking disabled with nothing happening.
        const form = event.currentTarget.form;
        if (form && form.checkValidity()) {
          setPending(true);
        }
      }}
      className={`mt-2 w-fit rounded-md bg-basil-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-basil-700 ${
        pending ? "pointer-events-none cursor-not-allowed opacity-60" : ""
      }`}
    >
      {pending ? "Thinking of something…" : "Suggest a recipe"}
    </button>
  );
}
