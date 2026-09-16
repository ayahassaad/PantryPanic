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

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  // RLS does the real filtering here: this query only ever returns rows
  // where recipes.owner_id = auth.uid() (this user's own) or owner_id is
  // null (public starter recipes) — enforced by Postgres, not this code.
  let recipesQuery = supabase
    .from("recipes")
    .select("id, title, description, tags, source")
    .order("created_at", { ascending: false });

  if (query) {
    // A plain parameterized ilike, not PostgREST's .or() string DSL — so
    // there's nothing a search term could contain (a comma, a paren)
    // that would break or reshape the filter itself.
    recipesQuery = recipesQuery.ilike("title", `%${query}%`);
  }

  const { data: recipes, error } = await recipesQuery.returns<RecipeListItem[]>();

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
        <div className="mt-1 flex flex-none items-center gap-3">
          <Link
            href="/recipes/suggest"
            className="w-fit rounded-md border border-basil-600 px-4 py-2 text-sm font-medium text-basil-700 transition hover:bg-basil-50"
          >
            Suggest with AI
          </Link>
          <Link
            href="/recipes/new"
            className="w-fit rounded-md bg-basil-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-basil-700"
          >
            New recipe
          </Link>
        </div>
      </div>

      {/* Plain GET form — no client JS needed. Submitting just navigates
          to /recipes?q=..., which this Server Component re-renders with
          the filtered results. */}
      <form className="mb-6 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search recipes by name"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-base outline-none focus:border-basil-600"
        />
        <button
          type="submit"
          className="w-fit rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          Search
        </button>
        {query && (
          <Link
            href="/recipes"
            className="flex w-fit items-center px-2 text-sm text-neutral-500 underline underline-offset-2"
          >
            Clear
          </Link>
        )}
      </form>

      {error && (
        <p className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Couldn&apos;t load recipes: {error.message}
        </p>
      )}

      {!error && recipes && recipes.length === 0 && (
        <p className="text-neutral-600">
          {query ? `No recipes match "${query}".` : "No recipes yet."}
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {recipes?.map((recipe) => (
          <li
            key={recipe.id}
            className="rounded-lg border border-neutral-200 px-5 py-4"
          >
            <h2 className="flex items-center gap-2 text-lg font-medium text-neutral-900">
              <Link
                href={`/recipes/${recipe.id}`}
                className="hover:underline"
              >
                {recipe.title}
              </Link>
              {recipe.source === "ai" && (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                  AI suggested
                </span>
              )}
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
