import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Mascot } from "@/components/mascot";
import { toggleFavorite } from "./actions";

interface RecipeListItem {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  source: "user" | "ai" | "seed";
  image_url: string | null;
}

// Cycled by card index rather than randomized — random per-render would
// cause a server/client hydration mismatch, so "slightly chaotic" here
// means "deterministically varied," not actually random.
const CARD_ACCENTS = ["bg-tomato-400", "bg-blueberry-400", "bg-leaf-400", "bg-carrot-400"];
const CARD_SHADOWS = [
  "hand-shadow-tomato",
  "hand-shadow-blueberry",
  "hand-shadow-leaf",
  "hand-shadow-carrot",
];
const CARD_TILTS = ["-rotate-1", "rotate-1", "-rotate-[0.4deg]", "rotate-[0.6deg]"];

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

  const favoritedIds = new Set((favoriteRows ?? []).map((row) => row.recipe_id as string));

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
          <div>
            <p className="mb-1 font-display text-xs font-semibold uppercase tracking-widest text-tomato-400">
              Recipes
            </p>
            <h1 className="-rotate-[0.6deg] font-display text-3xl font-bold text-ink sm:text-4xl">
              The recipe box
            </h1>
          </div>
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
          the filtered results. */}
      <form className="mb-8 flex max-w-lg gap-2">
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
            href="/recipes"
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

      {!error && recipes && recipes.length === 0 && (
        <p className="text-ink-soft">
          {query ? `No recipes match "${query}".` : "No recipes yet."}
        </p>
      )}

      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {recipes?.map((recipe, index) => {
          const isFavorited = favoritedIds.has(recipe.id);
          const accent = CARD_ACCENTS[index % CARD_ACCENTS.length] ?? "bg-tomato-400";
          const shadow = CARD_SHADOWS[index % CARD_SHADOWS.length] ?? "hand-shadow-tomato";
          const tilt = CARD_TILTS[index % CARD_TILTS.length] ?? "-rotate-1";

          return (
            <li
              key={recipe.id}
              className={`wobble-a ${shadow} ${tilt} border-2 border-ink bg-cream-card p-4`}
            >
              <div
                className={`wobble-b mb-3.5 flex h-32 items-center justify-center border-2 border-ink ${
                  recipe.image_url ? "" : accent
                }`}
              >
                {recipe.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a
                  // handful of user-uploaded images doesn't need next/image's
                  // optimization pipeline (which also needs a configured
                  // remote pattern for the Supabase Storage host).
                  <img
                    src={recipe.image_url}
                    alt=""
                    className="h-full w-full rounded-[16px] object-cover"
                  />
                ) : (
                  <Mascot className="h-16 w-14" />
                )}
              </div>
              <div className="flex items-start justify-between gap-3">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                  <Link href={`/recipes/${recipe.id}`} className="hover:underline">
                    {recipe.title}
                  </Link>
                </h2>
                <form action={toggleFavorite} className="flex-none">
                  <input type="hidden" name="recipeId" value={recipe.id} />
                  <input type="hidden" name="isFavorited" value={String(isFavorited)} />
                  <button
                    type="submit"
                    aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
                    aria-pressed={isFavorited}
                    className={`text-xl leading-none ${
                      isFavorited ? "text-citrus-600" : "text-ink-faint hover:text-ink-soft"
                    }`}
                  >
                    {isFavorited ? "★" : "☆"}
                  </button>
                </form>
              </div>
              {recipe.description && (
                <p className="mt-1 text-sm text-ink-soft">{recipe.description}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {recipe.source === "ai" && (
                  <span className="rounded-full border-2 border-ink bg-blueberry-400 px-2.5 py-0.5 text-xs font-extrabold text-cream">
                    AI suggested
                  </span>
                )}
                {recipe.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border-2 border-ink bg-cream-deep px-2.5 py-0.5 text-xs font-extrabold text-ink"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
