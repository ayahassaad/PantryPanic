import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MEAL_SLOTS } from "@pantry-panic/shared";
import { suggestRecipe } from "./actions";
import { SubmitButton } from "./submit-button";

export default async function SuggestRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-16">
      <Link
        href="/recipes"
        className="mb-8 w-fit text-sm text-neutral-500 underline underline-offset-2"
      >
        &larr; Back to recipes
      </Link>

      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-basil-600">
        Ask AI
      </p>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight text-basil-700">
        What&apos;s in your pantry?
      </h1>
      <p className="mb-8 max-w-md text-base text-neutral-600">
        List what you have on hand and we&apos;ll suggest a recipe. It&apos;s
        saved to your recipe library once it&apos;s ready — this can take a
        few seconds.
      </p>

      {error && (
        <p className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={suggestRecipe} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Ingredients
          <textarea
            name="ingredients"
            rows={6}
            required
            placeholder={"chicken thighs\nrice\nsoy sauce\ngarlic"}
            className="rounded-md border border-neutral-300 px-3 py-2 text-base outline-none focus:border-basil-600"
          />
          <span className="text-xs text-neutral-500">
            One ingredient per line.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Meal
          <select
            name="mealSlot"
            defaultValue=""
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:border-basil-600"
          >
            <option value="">Any</option>
            {MEAL_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {slot[0].toUpperCase() + slot.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Constraints
          <input
            name="constraints"
            type="text"
            placeholder="vegetarian, dairy-free, ready in 30 minutes"
            className="rounded-md border border-neutral-300 px-3 py-2 text-base outline-none focus:border-basil-600"
          />
          <span className="text-xs text-neutral-500">Optional.</span>
        </label>

        <SubmitButton />
      </form>
    </main>
  );
}
