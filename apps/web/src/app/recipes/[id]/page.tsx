import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  // recipe), Supabase just returns no row — either way it's a 404 to
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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-16">
      <Link
        href="/recipes"
        className="mb-8 w-fit text-sm text-neutral-500 underline underline-offset-2"
      >
        &larr; Back to recipes
      </Link>

      {recipe.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- a handful
        // of user-uploaded images doesn't need next/image's optimization
        // pipeline (which also needs a configured remote pattern for the
        // Supabase Storage host).
        <img
          src={recipe.image_url}
          alt=""
          className="mb-6 h-56 w-full rounded-lg object-cover"
        />
      )}

      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-basil-700">
          {recipe.title}
        </h1>
        <form action={toggleFavorite} className="flex-none pt-1">
          <input type="hidden" name="recipeId" value={recipe.id} />
          <input type="hidden" name="isFavorited" value={String(isFavorited)} />
          <button
            type="submit"
            aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={isFavorited}
            className={`text-2xl leading-none ${
              isFavorited ? "text-amber-500" : "text-neutral-300 hover:text-neutral-400"
            }`}
          >
            {isFavorited ? "★" : "☆"}
          </button>
        </form>
      </div>

      {recipe.description && (
        <p className="mb-4 text-base text-neutral-600">{recipe.description}</p>
      )}

      {recipe.tags.length > 0 && (
        <ul className="mb-8 flex flex-wrap gap-2">
          {recipe.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full bg-basil-50 px-2.5 py-1 text-xs font-medium text-basil-700"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}

      {ingredients && ingredients.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium text-neutral-900">
            Ingredients
          </h2>
          <ul className="flex flex-col gap-1.5">
            {ingredients.map((ingredient) => (
              <li key={ingredient.id} className="text-sm text-neutral-700">
                {[ingredient.quantity, ingredient.unit, ingredient.name]
                  .filter(Boolean)
                  .join(" ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium text-neutral-900">Steps</h2>
        <ol className="flex flex-col gap-3">
          {recipe.steps.map((step, index) => (
            <li key={index} className="flex gap-3 text-sm text-neutral-700">
              <span className="flex-none font-medium text-basil-600">
                {index + 1}.
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
