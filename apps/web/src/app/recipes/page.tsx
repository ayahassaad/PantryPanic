import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Mascot } from "@/components/mascot";
import { RecipeGrid, type RecipeListItem } from "./recipe-grid";

// The raw shape this page's own recipes query returns — everything
// RecipeListItem has except isOwner and ingredientNames, neither of
// which is a column on `recipes` itself: isOwner is derived below from
// owner_id (which the client never needs to see directly), and
// ingredientNames comes from a separate recipe_ingredients query.
type RecipeRow = Omit<RecipeListItem, "isOwner" | "ingredientNames"> & {
  owner_id: string | null;
};

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
  // owner_id itself is only fetched to compute isOwner below — it's never
  // passed down to the client as-is.
  //
  // Always the whole recipe box, whatever ?q= says: searching happens in
  // the browser now (see RecipeGrid), instantly as you type and across
  // ingredient names as well as titles, so the server no longer filters
  // by title itself.
  const recipesQuery = supabase
    .from("recipes")
    .select("id, title, description, tags, source, image_url, owner_id")
    .order("created_at", { ascending: false });

  const [{ data: recipeRows, error }, { data: favoriteRows }] = await Promise.all([
    recipesQuery.returns<RecipeRow[]>(),
    supabase.from("recipe_favorites").select("recipe_id").eq("owner_id", user.id),
  ]);

  // A card with no uploaded photo shows a goofy food-character placeholder
  // guessed from what the recipe's actually made of (see FoodMascot /
  // inferFoodKind) — which means this page needs each recipe's ingredient
  // names, not just its title/description. Same "fetch by .in() once,
  // group in memory" shape as shopping-list/actions.ts uses for the same
  // table. One query for every recipe on the page rather than one per
  // card — recipe_ingredients' select RLS policy already limits this to
  // rows on recipes this user can actually see, same as the recipes query
  // itself above.
  const recipeIds = (recipeRows ?? []).map((recipe) => recipe.id);
  const { data: ingredientRows } =
    recipeIds.length > 0
      ? await supabase
          .from("recipe_ingredients")
          .select("recipe_id, name")
          .in("recipe_id", recipeIds)
          .returns<{ recipe_id: string; name: string }[]>()
      : { data: [] as { recipe_id: string; name: string }[] };

  const ingredientNamesByRecipe = new Map<string, string[]>();
  for (const ingredient of ingredientRows ?? []) {
    const names = ingredientNamesByRecipe.get(ingredient.recipe_id) ?? [];
    names.push(ingredient.name);
    ingredientNamesByRecipe.set(ingredient.recipe_id, names);
  }

  // Edit/delete on a card only make sense for a recipe this user actually
  // created themselves (by hand or via the AI suggester) — starter/seed
  // recipes have owner_id null and aren't anyone's to change.
  const recipes: RecipeListItem[] = (recipeRows ?? []).map(
    ({ owner_id, ...recipe }) => ({
      ...recipe,
      isOwner: owner_id === user.id,
      ingredientNames: ingredientNamesByRecipe.get(recipe.id) ?? [],
    }),
  );

  const favoritedIds = (favoriteRows ?? []).map((row) => row.recipe_id as string);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-8 sm:px-10">
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

      {error && (
        <p className="wobble-btn mb-6 border-2 border-ink bg-tomato-50 px-4 py-3 text-sm font-bold text-tomato-700">
          Couldn&apos;t load recipes: {error.message}
        </p>
      )}

      {/* Search box, tabs + card grid live in a client component so
          searching and switching between "All" and "Favorites" are
          instant local re-renders instead of a full round trip back to
          the server. */}
      {!error && (
        <RecipeGrid
          recipes={recipes}
          favoritedIds={favoritedIds}
          initialQuery={query}
          initialTab={initialTab}
        />
      )}
    </main>
  );
}
