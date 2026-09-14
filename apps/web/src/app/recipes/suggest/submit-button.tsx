"use client";

import { useFormStatus } from "react-dom";

// Pulled out as its own client component because useFormStatus only works
// inside the <form> it reports on — the page itself stays a server
// component. A Claude call here takes several seconds; without this the
// button just sits there looking dead, which is exactly what happened:
// no feedback, so it got clicked repeatedly and made several recipes.
export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="mt-2 w-fit rounded-md bg-basil-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-basil-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Thinking of something…" : "Suggest a recipe"}
    </button>
  );
}
