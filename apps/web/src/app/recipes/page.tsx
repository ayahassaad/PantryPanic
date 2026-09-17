import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Mascot } from "@/components/mascot";
import { FavoriteButton } from "@/components/favorite-button";
import {
  DoodleCarrot,
  DoodleCheeseWedge,
  DoodleCitrusSlice,
  DoodleEgg,
  DoodleGrapes,
  DoodleLeafSprig,
  DoodleMug,
  DoodlePepper,
} from "@/components/food-doodles";
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

type DoodleShape = (props: { className?: string; style?: CSSProperties }) => JSX.Element;

const CARD_DOODLE_SHAPES: DoodleShape[] = [
  DoodleCarrot,
  DoodleCitrusSlice,
  DoodlePepper,
  DoodleLeafSprig,
  DoodleGrapes,
  DoodleMug,
  DoodleCheeseWedge,
  DoodleEgg,
];
const CARD_DOODLE_SIZES = ["h-4 w-4", "h-5 w-5", "h-6 w-6"];
const CARD_DOODLE_COUNT = 5;

// Same deterministic "random" trick used on the login page's background
// doodles — a plain seeded function, not Math.random(), so this server-
// rendered markup comes out identical on hydration.
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

interface CardDoodle {
  key: number;
  Shape: DoodleShape;
  sizeClass: string;
  style: CSSProperties;
}

// One set of "raindrops" per card, seeded off that card's position in the
// grid so every card gets its own stable mix of shapes/sizes/timing.
function cardDoodles(cardIndex: number): CardDoodle[] {
  const doodles: CardDoodle[] = [];

  for (let i = 0; i < CARD_DOODLE_COUNT; i++) {
    const seed = cardIndex * 97.13 + i * 11.37;
    const Shape =
      CARD_DOODLE_SHAPES[Math.floor(pseudoRandom(seed) * CARD_DOODLE_SHAPES.length)] ??
      DoodleCarrot;
    const sizeClass =
      CARD_DOODLE_SIZES[Math.floor(pseudoRandom(seed + 1) * CARD_DOODLE_SIZES.length)] ??
      "h-5 w-5";
    const left = 4 + pseudoRandom(seed + 2) * 88;
    const delay = pseudoRandom(seed + 3) * 2.4;
    const duration = 2.3 + pseudoRandom(seed + 4) * 1.3;

    doodles.push({
      key: i,
      Shape,
      sizeClass,
      style: {
        left: `${left}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
      },
    });
  }

  return doodles;
}

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
  const activeTab = tab === "favorites" ? "favorites" : "all";

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

  // A recipe you favorite still shows up here in "All" — favoriting just
  // also puts a copy of it under "Favorites", it never moves it out of
  // the main list.
  const displayedRecipes =
    activeTab === "favorites"
      ? (recipes ?? []).filter((recipe) => favoritedIds.has(recipe.id))
      : (recipes ?? []);

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

      {/* Tabs: "All" always shows everything; "Favorites" is a filtered
          view of the same list, not a separate place things move to —
          favoriting a recipe never removes it from "All". */}
      <div className="mb-6 flex gap-2">
        <Link
          href={buildHref({ q: query })}
          aria-current={activeTab === "all" ? "page" : undefined}
          className={`wobble-btn border-2 border-ink px-4 py-1.5 font-display text-sm font-semibold transition ${
            activeTab === "all"
              ? "bg-tomato-400 text-cream"
              : "bg-cream-card text-ink hover:bg-cream-deep"
          }`}
        >
          All
        </Link>
        <Link
          href={buildHref({ q: query, tab: "favorites" })}
          aria-current={activeTab === "favorites" ? "page" : undefined}
          className={`wobble-btn border-2 border-ink px-4 py-1.5 font-display text-sm font-semibold transition ${
            activeTab === "favorites"
              ? "bg-citrus-400 text-ink"
              : "bg-cream-card text-ink hover:bg-cream-deep"
          }`}
        >
          ★ Favorites
        </Link>
      </div>

      {/* Plain GET form — no client JS needed. Submitting just navigates
          to /recipes?q=..., which this Server Component re-renders with
          the filtered results. Carries the active tab along so searching
          doesn't bounce you back to "All". */}
      <form className="mb-8 flex max-w-lg gap-2">
        {activeTab === "favorites" && <input type="hidden" name="tab" value="favorites" />}
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
            href={buildHref({ tab: activeTab === "favorites" ? "favorites" : undefined })}
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

      {!error && displayedRecipes.length === 0 && (
        <p className="text-ink-soft">
          {activeTab === "favorites"
            ? "No favorites yet — tap the star on a recipe to add it here."
            : query
              ? `No recipes match "${query}".`
              : "No recipes yet."}
        </p>
      )}

      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {displayedRecipes.map((recipe, index) => {
          const isFavorited = favoritedIds.has(recipe.id);
          const accent = CARD_ACCENTS[index % CARD_ACCENTS.length] ?? "bg-tomato-400";
          const shadow = CARD_SHADOWS[index % CARD_SHADOWS.length] ?? "hand-shadow-tomato";
          const tilt = CARD_TILTS[index % CARD_TILTS.length] ?? "-rotate-1";

          return (
            <li
              key={recipe.id}
              className={`wobble-a ${shadow} ${tilt} group relative overflow-hidden border-2 border-ink bg-cream-card p-4 transition duration-200 hover:-translate-y-1 hover:brightness-[1.03]`}
            >
              {/* Decorative doodles that rain down the card on hover.
                  They sit above the image box but below the text block
                  right below (which has its own solid background) — so a
                  falling doodle just disappears the instant it would
                  reach any text instead of ever overlapping it. Paused
                  by default in globals.css, so this costs nothing until
                  you're actually hovering. */}
              <div className="pointer-events-none absolute inset-0 z-[5]" aria-hidden="true">
                {cardDoodles(index).map(({ key, Shape, sizeClass, style }) => (
                  <Shape
                    key={key}
                    className={`card-doodle-fall absolute top-0 ${sizeClass}`}
                    style={style}
                  />
                ))}
              </div>

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

              <div className="relative z-10 bg-cream-card">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                    <Link href={`/recipes/${recipe.id}`} className="hover:underline">
                      {recipe.title}
                    </Link>
                  </h2>
                  <FavoriteButton
                    recipeId={recipe.id}
                    initialFavorited={isFavorited}
                    toggleFavorite={toggleFavorite}
                    size="sm"
                  />
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
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
