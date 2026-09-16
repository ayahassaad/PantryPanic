import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MEAL_SLOTS, type MealSlot } from "@pantry-panic/shared";
import { removeMealPlanEntry, setMealPlanEntry } from "./actions";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Monday of the week containing `date`, in UTC so the grid doesn't shift
// by a day depending on the server's local timezone.
function startOfWeek(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

interface PlannerEntry {
  id: string;
  plan_date: string;
  meal_slot: MealSlot;
  servings: number;
  recipe: { id: string; title: string } | null;
}

interface RecipeOption {
  id: string;
  title: string;
}

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { week } = await searchParams;
  const anchor =
    week && /^\d{4}-\d{2}-\d{2}$/.test(week)
      ? new Date(`${week}T00:00:00Z`)
      : new Date();
  const weekStart = startOfWeek(anchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekStartISO = toISODate(weekStart);
  const weekEndISO = toISODate(weekDays[6]);
  const prevWeekISO = toISODate(addDays(weekStart, -7));
  const nextWeekISO = toISODate(addDays(weekStart, 7));
  const todayISO = toISODate(new Date());

  // recipe:recipes(id, title) embeds the joined recipe via the recipe_id
  // foreign key — PostgREST resolves the relationship automatically, no
  // manual join needed.
  const [{ data: entries }, { data: recipes }] = await Promise.all([
    supabase
      .from("meal_plan_entries")
      .select("id, plan_date, meal_slot, servings, recipe:recipes(id, title)")
      .eq("user_id", user.id)
      .gte("plan_date", weekStartISO)
      .lte("plan_date", weekEndISO)
      .returns<PlannerEntry[]>(),
    supabase
      .from("recipes")
      .select("id, title")
      .order("title")
      .returns<RecipeOption[]>(),
  ]);

  const entryByCell = new Map<string, PlannerEntry>();
  for (const entry of entries ?? []) {
    entryByCell.set(`${entry.plan_date}_${entry.meal_slot}`, entry);
  }

  const hasRecipes = Boolean(recipes && recipes.length > 0);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-16">
      <Link
        href="/dashboard"
        className="mb-8 w-fit text-sm text-neutral-500 underline underline-offset-2"
      >
        &larr; Back to dashboard
      </Link>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-basil-600">
            Planner
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-basil-700">
            Week of{" "}
            {weekStart.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            })}
          </h1>
        </div>
        <div className="flex flex-none gap-2">
          <Link
            href={`/planner?week=${prevWeekISO}`}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-100"
          >
            &larr; Prev
          </Link>
          <Link
            href={`/planner?week=${todayISO}`}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-100"
          >
            Today
          </Link>
          <Link
            href={`/planner?week=${nextWeekISO}`}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-100"
          >
            Next &rarr;
          </Link>
        </div>
      </div>

      {!hasRecipes && (
        <p className="mb-6 rounded-md bg-basil-50 px-4 py-3 text-sm text-basil-700">
          You don&apos;t have any recipes yet —{" "}
          <Link href="/recipes/new" className="underline">
            add one
          </Link>{" "}
          or{" "}
          <Link href="/recipes/suggest" className="underline">
            ask AI for one
          </Link>{" "}
          before planning your week.
        </p>
      )}

      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-[70px_repeat(7,1fr)] gap-2">
          <div />
          {weekDays.map((day, i) => (
            <div key={toISODate(day)} className="text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {DAY_LABELS[i]}
              </p>
              <p
                className={`text-sm ${
                  toISODate(day) === todayISO
                    ? "font-semibold text-basil-700"
                    : "text-neutral-700"
                }`}
              >
                {day.getUTCDate()}
              </p>
            </div>
          ))}

          {MEAL_SLOTS.flatMap((slot) => [
            <div
              key={`${slot}-label`}
              className="flex items-center text-xs font-medium uppercase tracking-wide text-neutral-500"
            >
              {slot}
            </div>,
            ...weekDays.map((day) => {
              const dateISO = toISODate(day);
              const entry = entryByCell.get(`${dateISO}_${slot}`);

              return (
                <div
                  key={`${slot}-${dateISO}`}
                  className="min-h-[88px] rounded-md border border-neutral-200 p-2"
                >
                  {entry ? (
                    <div className="flex h-full flex-col justify-between gap-1">
                      <div>
                        {entry.recipe ? (
                          <Link
                            href={`/recipes/${entry.recipe.id}`}
                            className="text-xs font-medium text-neutral-900 hover:underline"
                          >
                            {entry.recipe.title}
                          </Link>
                        ) : (
                          <span className="text-xs text-neutral-400">
                            Recipe removed
                          </span>
                        )}
                        {entry.servings > 1 && (
                          <p className="text-[11px] text-neutral-500">
                            {entry.servings} servings
                          </p>
                        )}
                      </div>
                      <form action={removeMealPlanEntry}>
                        <input type="hidden" name="entryId" value={entry.id} />
                        <button
                          type="submit"
                          className="text-[11px] text-neutral-400 underline hover:text-neutral-600"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  ) : hasRecipes ? (
                    <form
                      action={setMealPlanEntry}
                      className="flex h-full flex-col gap-1"
                    >
                      <input type="hidden" name="planDate" value={dateISO} />
                      <input type="hidden" name="mealSlot" value={slot} />
                      <select
                        name="recipeId"
                        required
                        defaultValue=""
                        className="w-full rounded border border-neutral-200 bg-white px-1 py-1 text-[11px] outline-none focus:border-basil-600"
                      >
                        <option value="" disabled>
                          + Add
                        </option>
                        {recipes?.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.title}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded bg-basil-50 px-1 py-0.5 text-[11px] font-medium text-basil-700 transition hover:bg-basil-100"
                      >
                        Set
                      </button>
                    </form>
                  ) : null}
                </div>
              );
            }),
          ])}
        </div>
      </div>
    </main>
  );
}
