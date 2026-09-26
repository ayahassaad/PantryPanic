import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MEAL_SLOTS } from "@pantry-panic/shared";
import { Mascot } from "@/components/mascot";
import { suggestRecipe } from "./actions";
import { SubmitButton } from "./submit-button";
import { AI_RATE_LIMIT_MAX_REQUESTS, countRecentAiRequests } from "@/lib/ai-rate-limit";

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

  // Same shared daily counter "Fill week with AI" draws from — see
  // lib/ai-rate-limit.ts — so this reflects however many of the two
  // features' combined budget is left, not a separate pool of its own.
  const recentAiRequestCount = await countRecentAiRequests(supabase, user.id);
  const aiRequestsRemaining = Math.max(
    0,
    AI_RATE_LIMIT_MAX_REQUESTS - (recentAiRequestCount ?? 0),
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-8 sm:px-10">
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

        <SubmitButton hasError={Boolean(error)} outOfRequests={aiRequestsRemaining <= 0} />
        <span className="-mt-3 text-xs font-semibold text-ink-faint">
          {aiRequestsRemaining > 0
            ? `${aiRequestsRemaining} of ${AI_RATE_LIMIT_MAX_REQUESTS} AI suggestions left today`
            : "Resets tomorrow."}
        </span>
      </form>
    </main>
  );
}
