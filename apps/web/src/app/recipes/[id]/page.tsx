import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Mascot } from "@/components/mascot";
import { toggleFavorite } from "../actions";

interface RecipeDetail {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  steps: string[];
  image_url: string | null;
}

interface RecipeIngredientRow {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // If this id doesn't exist, or RLS blocks it (someone else's private
  // recipe), Supabase just returns no row. Either way it's a 404 to
  // this user, not an error, so we don't leak which case it was.
  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, title, description, tags, steps, image_url")
    .eq("id", id)
    .maybeSingle<RecipeDetail>();

  if (!recipe) {
    notFound();
  }

  const [{ data: ingredients }, { data: favorite }] = await Promise.all([
    supabase
      .from("recipe_ingredients")
      .select("id, name, quantity, unit")
      .eq("recipe_id", id)
      .order("sort_order")
      .returns<RecipeIngredientRow[]>(),
    supabase
      .from("recipe_favorites")
      .select("recipe_id")
      .eq("owner_id", user.id)
      .eq("recipe_id", id)
      .maybeSingle(),
  ]);

  const isFavorited = Boolean(favorite);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-8 sm:px-10">
      <Link
        href="/recipes"
        className="mb-8 w-fit border-b-2 border-dashed border-ink-soft text-sm font-bold text-ink-soft transition hover:text-ink"
      >
        &larr; Recipes
      </Link>

      {recipe.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a handful
        // of user-uploaded images doesn't need next/image's optimization
        // pipeline (which also needs a configured remote pattern for the
        // Supabase Storage host).
        <img
          src={recipe.image_url}
          alt=""
          className="wobble-a hand-shadow mb-6 h-56 w-full border-2 border-ink object-cover"
        />
      ) : (
        <div className="wobble-a hand-shadow mb-6 flex h-40 items-center justify-center border-2 border-ink bg-tomato-400">
          <Mascot className="h-20 w-[70px]" />
        </div>
      )}

      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="-rotate-[0.4deg] font-display text-3xl font-bold text-ink">
          {recipe.title}
        </h1>
        <form action={toggleFavorite} className="flex-none pt-1">
          <input type="hidden" name="recipeId" value={recipe.id} />
          <input type="hidden" name="isFavorited" value={String(isFavorited)} />
          <button
            type="submit"
            aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={isFavorited}
            className={`text-3xl leading-none ${
              isFavorited ? "text-citrus-600" : "text-ink-faint hover:text-ink-soft"
            }`}
          >
            {isFavorited ? "★" : "☆"}
          </button>
        </form>
      </div>

      {recipe.description && (
        <p className="mb-4 text-base text-ink-soft">{recipe.description}</p>
      )}

      {recipe.tags.length > 0 && (
        <ul className="mb-8 flex flex-wrap gap-1.5">
          {recipe.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full border-2 border-ink bg-cream-deep px-2.5 py-0.5 text-xs font-extrabold text-ink"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}

      {ingredients && ingredients.length > 0 && (
        <section className="mb-8">
          <p className="mb-3 font-display text-xs font-semibold uppercase tracking-widest text-leaf-600">
            Ingredients
          </p>
          <ul className="flex flex-col gap-2">
            {ingredients.map((ingredient) => (
              <li key={ingredient.id} className="flex items-center gap-2.5 text-sm font-bold text-ink">
                <span className="h-2 w-2 flex-none rounded-full bg-leaf-400" />
                {[ingredient.quantity, ingredient.unit, ingredient.name]
                  .filter(Boolean)
                  .join(" ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <p className="mb-3 font-display text-xs font-semibold uppercase tracking-widest text-tomato-400">
          Steps
        </p>
        <ol className="flex flex-col gap-3.5">
          {recipe.steps.map((step, index) => (
            <li key={index} className="flex gap-3 text-sm text-ink">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 border-ink bg-tomato-400 font-display text-xs font-bold text-cream">
                {index + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
