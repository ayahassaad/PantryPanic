import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface RecipeDetail {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  steps: string[];
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
    .select("id, title, description, tags, steps")
    .eq("id", id)
    .maybeSingle<RecipeDetail>();

  if (!recipe) {
    notFound();
  }

  const { data: ingredients } = await supabase
    .from("recipe_ingredients")
    .select("id, name, quantity, unit")
    .eq("recipe_id", id)
    .order("sort_order")
    .returns<RecipeIngredientRow[]>();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-16">
      <Link
        href="/recipes"
        className="mb-8 w-fit text-sm text-neutral-500 underline underline-offset-2"
      >
        &larr; Back to recipes
      </Link>

      <h1 className="mb-2 text-3xl font-semibold tracking-tight text-basil-700">
        {recipe.title}
      </h1>

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
