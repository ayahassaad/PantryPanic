import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Mascot } from "@/components/mascot";
import { RecipeGrid, type RecipeListItem } from "./recipe-grid";

function buildHref(params: { q?: string; tab?: string }): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.tab) search.set("tab", params.tab);
  const qs = search.toString();
  return qs ? `/recipes?${qs}` : "/recipes";
}

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { q, tab } = await searchParams;
  const query = q?.trim() ?? "";
  const initialTab = tab === "favorites" ? "favorites" : "all";

  // RLS does the real filtering here: this query only ever returns rows
  // where recipes.owner_id = auth.uid() (this user's own) or owner_id is
  // null (public starter recipes) — enforced by Postgres, not this code.
  let recipesQuery = supabase
    .from("recipes")
    .select("id, title, description, tags, source, image_url")
    .order("created_at", { ascending: false });

  if (query) {
    // A plain parameterized ilike, not PostgREST's .or() string DSL — so
    // there's nothing a search term could contain (a comma, a paren)
    // that would break or reshape the filter itself.
    recipesQuery = recipesQuery.ilike("title", `%${query}%`);
  }

  const [{ data: recipes, error }, { data: favoriteRows }] = await Promise.all([
    recipesQuery.returns<RecipeListItem[]>(),
    supabase.from("recipe_favorites").select("recipe_id").eq("owner_id", user.id),
  ]);

  const favoritedIds = (favoriteRows ?? []).map((row) => row.recipe_id as string);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-8 sm:px-10">
      <Link
        href="/dashboard"
        className="mb-8 w-fit border-b-2 border-dashed border-ink-soft text-sm font-bold text-ink-soft transition hover:text-ink"
      >
        &larr; Dashboard
      </Link>

      <div className="mb-7 flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          <Mascot className="h-[70px] w-16 flex-none" />
          <h1 className="-rotate-[0.6deg] font-display text-3xl font-bold text-ink sm:text-4xl">
            The recipe box
          </h1>
        </div>
        <div className="flex flex-none items-center gap-3">
          <Link
            href="/recipes/suggest"
            className="wobble-btn hand-shadow bg-citrus-400 px-5 py-2.5 font-display text-sm font-semibold text-ink transition hover:brightness-105"
          >
            &#10022; Suggest with AI
          </Link>
          <Link
            href="/recipes/new"
            className="wobble-btn hand-shadow bg-tomato-400 px-5 py-2.5 font-display text-sm font-semibold text-cream transition hover:brightness-105"
          >
            + New recipe
          </Link>
        </div>
      </div>

      {/* Plain GET form — no client JS needed. Submitting just navigates
          to /recipes?q=..., which this Server Component re-renders with
          the filtered results. Carries the active tab along so searching
          doesn't bounce you back to "All" on reload. */}
      <form className="mb-8 flex max-w-lg gap-2">
        {initialTab === "favorites" && <input type="hidden" name="tab" value="favorites" />}
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search recipes by name"
          className="flex-1 rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none placeholder:text-ink-faint focus:border-tomato-400"
        />
        <button
          type="submit"
          className="rounded-xl border-2 border-ink bg-cream-deep px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-cream"
        >
          Search
        </button>
        {query && (
          <Link
            href={buildHref({ tab: initialTab === "favorites" ? "favorites" : undefined })}
            className="flex items-center px-2 text-sm font-bold text-ink-soft underline underline-offset-2"
          >
            Clear
          </Link>
        )}
      </form>

      {error && (
        <p className="wobble-btn mb-6 border-2 border-ink bg-tomato-50 px-4 py-3 text-sm font-bold text-tomato-700">
          Couldn&apos;t load recipes: {error.message}
        </p>
      )}

      {/* Tabs + card grid live in a client component so switching between
          "All" and "Favorites" is an instant local re-render instead of
          a full round trip back to the server. */}
      {!error && (
        <RecipeGrid
          recipes={recipes ?? []}
          favoritedIds={favoritedIds}
          query={query}
          initialTab={initialTab}
        />
      )}
    </main>
  );
}
