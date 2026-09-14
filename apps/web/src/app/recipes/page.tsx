import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface RecipeListItem {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  source: "user" | "ai" | "seed";
}

export default async function RecipesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // RLS does the real filtering here: this query only ever returns rows
  // where recipes.owner_id = auth.uid() (this user's own) or owner_id is
  // null (public starter recipes) — enforced by Postgres, not this code.
  const { data: recipes, error } = await supabase
    .from("recipes")
    .select("id, title, description, tags, source")
    .order("created_at", { ascending: false })
    .returns<RecipeListItem[]>();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-16">
      <Link
        href="/dashboard"
        className="mb-8 w-fit text-sm text-neutral-500 underline underline-offset-2"
      >
        &larr; Back to dashboard
      </Link>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-basil-600">
            Recipes
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-basil-700">
            Recipe library
          </h1>
        </div>
        <Link
          href="/recipes/new"
          className="mt-1 w-fit flex-none rounded-md bg-basil-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-basil-700"
        >
          New recipe
        </Link>
      </div>

      {error && (
        <p className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Couldn&apos;t load recipes: {error.message}
        </p>
      )}

      {!error && recipes && recipes.length === 0 && (
        <p className="text-neutral-600">No recipes yet.</p>
      )}

      <ul className="flex flex-col gap-4">
        {recipes?.map((recipe) => (
          <li
            key={recipe.id}
            className="rounded-lg border border-neutral-200 px-5 py-4"
          >
            <h2 className="text-lg font-medium text-neutral-900">
              {recipe.title}
            </h2>
            {recipe.description && (
              <p className="mt-1 text-sm text-neutral-600">
                {recipe.description}
              </p>
            )}
            {recipe.tags.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
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
          </li>
        ))}
      </ul>
    </main>
  );
}
