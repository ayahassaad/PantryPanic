import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MEAL_SLOTS } from "@pantry-panic/shared";
import { Mascot } from "@/components/mascot";
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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-8 sm:px-10">
      <Link
        href="/recipes"
        className="mb-8 w-fit border-b-2 border-dashed border-ink-soft text-sm font-bold text-ink-soft transition hover:text-ink"
      >
        &larr; Recipes
      </Link>

      <div className="mb-6 flex items-center gap-4">
        <Mascot className="h-[58px] w-[52px] flex-none" />
        <div>
          <p className="mb-1 font-display text-xs font-semibold uppercase tracking-widest text-blueberry-400">
            Ask AI
          </p>
          <h1 className="-rotate-[0.4deg] font-display text-2xl font-bold text-ink sm:text-3xl">
            What&apos;s in your pantry?
          </h1>
        </div>
      </div>
      <p className="mb-7 max-w-md text-base text-ink-soft">
        List what you have on hand and we&apos;ll suggest a recipe. It&apos;s
        saved to your recipe library once it&apos;s ready. This can take a
        few seconds.
      </p>

      {error && (
        <p className="wobble-btn mb-6 border-2 border-ink bg-tomato-50 px-4 py-3 text-sm font-bold text-tomato-700">
          {error}
        </p>
      )}

      <form action={suggestRecipe} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
          Ingredients
          <textarea
            name="ingredients"
            rows={6}
            required
            placeholder={"chicken thighs\nrice\nsoy sauce\ngarlic"}
            className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none placeholder:text-ink-faint focus:border-blueberry-400"
          />
          <span className="text-xs font-normal text-ink-faint">
            One ingredient per line.
          </span>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
          Meal
          <select
            name="mealSlot"
            defaultValue=""
            className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none focus:border-blueberry-400"
          >
            <option value="">Any</option>
            {MEAL_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {slot.charAt(0).toUpperCase() + slot.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
          Constraints
          <input
            name="constraints"
            type="text"
            placeholder="vegetarian, dairy-free, ready in 30 minutes"
            className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none placeholder:text-ink-faint focus:border-blueberry-400"
          />
          <span className="text-xs font-normal text-ink-faint">Optional.</span>
        </label>

        <SubmitButton hasError={Boolean(error)} />
      </form>
    </main>
  );
}
