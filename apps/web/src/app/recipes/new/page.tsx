import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createRecipe } from "./actions";
import { IngredientRows } from "./ingredient-rows";

export default async function NewRecipePage({
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

      <p className="mb-1 font-display text-xs font-semibold uppercase tracking-widest text-tomato-400">
        New recipe
      </p>
      <h1 className="-rotate-[0.4deg] mb-7 font-display text-3xl font-bold text-ink">
        Add a recipe
      </h1>

      {error && (
        <p className="wobble-btn mb-6 border-2 border-ink bg-tomato-50 px-4 py-3 text-sm font-bold text-tomato-700">
          {error}
        </p>
      )}

      <form className="flex flex-col gap-5" encType="multipart/form-data">
        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
          Photo
          <input
            name="image"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="rounded-xl border-2 border-ink bg-cream-card px-3 py-2 text-sm text-ink file:mr-3 file:rounded-lg file:border-2 file:border-ink file:bg-cream-deep file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-ink hover:file:bg-cream"
          />
          <span className="text-xs font-normal text-ink-faint">
            Optional. PNG, JPEG, WebP, or GIF, up to 5MB.
          </span>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
          Title
          <input
            name="title"
            type="text"
            required
            className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none focus:border-tomato-400"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
          Description
          <textarea
            name="description"
            rows={2}
            className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none focus:border-tomato-400"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
          Tags
          <input
            name="tags"
            type="text"
            placeholder="quick, vegetarian, pasta"
            className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none placeholder:text-ink-faint focus:border-tomato-400"
          />
          <span className="text-xs font-normal text-ink-faint">Comma-separated.</span>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-ink-soft">Ingredients</span>
          <IngredientRows />
          <span className="text-xs font-normal text-ink-faint">
            Quantity and unit are optional. Leave blank for things like
            &quot;salt to taste&quot;.
          </span>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
          Steps
          <textarea
            name="steps"
            rows={6}
            required
            placeholder={"Boil a pot of salted water.\nCook the pasta until al dente."}
            className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none placeholder:text-ink-faint focus:border-tomato-400"
          />
          <span className="text-xs font-normal text-ink-faint">
            One step per line.
          </span>
        </label>

        <button
          formAction={createRecipe}
          className="wobble-btn hand-shadow mt-2 w-fit bg-tomato-400 px-5 py-2.5 font-display text-sm font-semibold text-cream transition hover:brightness-105"
        >
          Save recipe
        </button>
      </form>
    </main>
  );
}
