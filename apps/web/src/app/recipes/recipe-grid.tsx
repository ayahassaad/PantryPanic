"use client";

import type { CSSProperties } from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Mascot } from "@/components/mascot";
import { FoodMascot, inferFoodKind } from "@/components/food-mascot";
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
import { deleteRecipeCard, toggleFavorite } from "./actions";
import { AddToPlannerButton } from "./add-to-planner-button";

export interface RecipeListItem {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  source: "user" | "ai" | "seed";
  image_url: string | null;
  // True for a recipe this user created themselves — by hand, or via the
  // AI suggester (both set owner_id to the creator). False for the
  // built-in starter/seed recipes, which have no owner and aren't
  // anyone's to edit or delete. Computed server-side in page.tsx so the
  // client never needs to see raw owner_id values.
  isOwner: boolean;
  // Every recipe_ingredients.name for this recipe, fetched separately in
  // page.tsx — the real "what's this made of" signal the no-photo
  // placeholder below is guessed from, ahead of just title/description
  // text. Empty for a recipe with no structured ingredient rows.
  ingredientNames: string[];
}

// A Next.js redirect() (e.g. "not logged in any more") works by throwing
// a special error with a digest starting "NEXT_REDIRECT" — Next's own
// runtime catches that to perform the navigation. If the catch block
// below swallowed it like a normal error, the redirect would silently
// never happen, so it's explicitly let through instead.
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
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

// A small badge in the corner of the card's picture saying where a
// recipe came from — only for the two kinds that aren't simply "one you
// typed in yourself" (source: "user"), which needs no label.
const SOURCE_BADGES: Partial<Record<RecipeListItem["source"], { label: string; className: string }>> = {
  ai: { label: "\u2726 AI", className: "bg-blueberry-400 text-cream" },
  seed: { label: "Starter", className: "bg-cream-card text-ink" },
};

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
// doodles — a plain seeded function, not Math.random(), so every card
// keeps its own stable mix of shapes/timing across re-renders (switching
// tabs, favoriting something) instead of reshuffling under you.
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

type SortOrder = "newest" | "az" | "favorites";

const SORT_LABELS: Record<SortOrder, string> = {
  newest: "Newest first",
  az: "A to Z",
  favorites: "Favorites first",
};

interface RecipeGridProps {
  recipes: RecipeListItem[];
  favoritedIds: string[];
  // Whatever ?q= the page was opened with — only the search box's
  // starting text; from then on the box is plain local state.
  initialQuery: string;
  initialTab: "all" | "favorites";
}

// Search box, tabs + the card grid, as one client component so typing in
// the search box or switching between "All" and "Favorites" is an
// instant local re-render instead of a full round trip back to the
// server (which is what made it feel laggy when the tabs were
// <Link href="/recipes?tab=..."> navigations, and the search a form you
// had to submit). Everything it needs — the recipe list, each recipe's
// ingredient names, and which ones are favorited — is fetched once by
// the server page and handed down as plain props.
export function RecipeGrid({ recipes, favoritedIds: initialFavoritedIds, initialQuery, initialTab }: RecipeGridProps) {
  const [tab, setTab] = useState<"all" | "favorites">(initialTab);
  const [search, setSearch] = useState(initialQuery);
  // What's actually matched against: trimmed and lowercased once here
  // rather than on every recipe.
  const query = search.trim().toLowerCase();
  // Its own copy of "which ids are favorited," kept current by
  // FavoriteButton's onToggle — so starring/unstarring a recipe updates
  // whether it's in the Favorites tab immediately, not just its star
  // color.
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(
    () => new Set(initialFavoritedIds),
  );
  // Recipes deleted from a card, tracked here rather than removed from
  // `recipes` directly — same reasoning as favoritedIds: React state, not
  // a mutation of the prop array.
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  // The one tag the grid is narrowed to, if any — picked from the row of
  // tag chips above the grid. One at a time (clicking another swaps it,
  // clicking the active one clears it) rather than a multi-select: with a
  // personal recipe box's worth of tags, "show me the vegetarian ones" is
  // the whole use case.
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [, startTransition] = useTransition();

  function handleToggle(recipeId: string, isFavorited: boolean) {
    setFavoritedIds((prev) => {
      const next = new Set(prev);
      if (isFavorited) {
        next.add(recipeId);
      } else {
        next.delete(recipeId);
      }
      return next;
    });
  }

  function handleDelete(recipeId: string) {
    if (!window.confirm("Delete this recipe? This can't be undone.")) {
      return;
    }

    setDeletedIds((prev) => new Set(prev).add(recipeId));

    startTransition(async () => {
      try {
        const result = await deleteRecipeCard(recipeId);
        if (result.error) {
          // Couldn't actually delete it — put the card back rather than
          // leave the grid quietly wrong.
          setDeletedIds((prev) => {
            const next = new Set(prev);
            next.delete(recipeId);
            return next;
          });
        }
      } catch (error) {
        if (isRedirectError(error)) {
          throw error;
        }
        setDeletedIds((prev) => {
          const next = new Set(prev);
          next.delete(recipeId);
          return next;
        });
      }
    });
  }

  // A recipe you favorite still shows up in "All" — favoriting just also
  // puts a copy of it under "Favorites", it never moves it out of the
  // main list.
  const visibleRecipes = recipes.filter((recipe) => !deletedIds.has(recipe.id));
  const tabRecipes =
    tab === "favorites"
      ? visibleRecipes.filter((recipe) => favoritedIds.has(recipe.id))
      : visibleRecipes;
  const taggedRecipes = activeTag
    ? tabRecipes.filter((recipe) => recipe.tags.includes(activeTag))
    : tabRecipes;
  // A search matches on the title or on any ingredient — "what can I
  // make with the chicken I've got" is as common a question as "where's
  // that curry" — using the ingredient names the page already loads for
  // the no-photo placeholder.
  const matchingRecipes = query
    ? taggedRecipes.filter(
        (recipe) =>
          recipe.title.toLowerCase().includes(query) ||
          recipe.ingredientNames.some((name) => name.toLowerCase().includes(query)),
      )
    : taggedRecipes;
  // "Newest first" is simply the order the server query already returns
  // (created_at descending), so it needs no sorting here. The other two
  // sort a copy — Array#sort is stable, so within "favorites first" each
  // group keeps that newest-first order.
  const displayedRecipes =
    sortOrder === "az"
      ? [...matchingRecipes].sort((a, b) => a.title.localeCompare(b.title))
      : sortOrder === "favorites"
        ? [...matchingRecipes].sort(
            (a, b) => Number(favoritedIds.has(b.id)) - Number(favoritedIds.has(a.id)),
          )
        : matchingRecipes;

  // Every tag in use, most-used first (ties alphabetical) — built from
  // the whole recipe box rather than the current tab, so the row of chips
  // doesn't reshuffle when switching between All and Favorites.
  const tagCounts = new Map<string, number>();
  for (const recipe of visibleRecipes) {
    for (const tag of recipe.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const allTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);

  return (
    <>
      <div className="mb-8 flex max-w-lg gap-2">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or ingredient"
          aria-label="Search recipes by name or ingredient"
          className="flex-1 rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none placeholder:text-ink-faint focus:border-tomato-400"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="flex items-center px-2 text-sm font-bold text-ink-soft underline underline-offset-2"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("all")}
          aria-pressed={tab === "all"}
          className={`wobble-btn border-2 border-ink px-4 py-1.5 font-display text-sm font-semibold transition ${
            tab === "all" ? "bg-tomato-400 text-cream" : "bg-cream-card text-ink hover:bg-cream-deep"
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setTab("favorites")}
          aria-pressed={tab === "favorites"}
          className={`wobble-btn border-2 border-ink px-4 py-1.5 font-display text-sm font-semibold transition ${
            tab === "favorites"
              ? "bg-citrus-400 text-ink"
              : "bg-cream-card text-ink hover:bg-cream-deep"
          }`}
        >
          ★ Favorites
        </button>
        <label className="ml-auto flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-ink-soft">
          Sort
          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            className="rounded-xl border-2 border-ink bg-cream-card px-3 py-1.5 text-sm font-bold normal-case tracking-normal text-ink outline-none focus:border-tomato-400"
          >
            {(Object.keys(SORT_LABELS) as SortOrder[]).map((order) => (
              <option key={order} value={order}>
                {SORT_LABELS[order]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {allTags.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-extrabold uppercase tracking-wide text-ink-soft">
            Tags
          </span>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              aria-pressed={activeTag === tag}
              className={`rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-extrabold transition ${
                activeTag === tag ? "bg-leaf-400 text-ink" : "bg-cream-deep text-ink hover:bg-cream"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {displayedRecipes.length === 0 && (tab === "favorites" || query || activeTag) && (
        <p className="text-ink-soft">
          {query
            ? `No ${tab === "favorites" ? "favorites" : "recipes"} match "${search.trim()}"${
                activeTag ? ` with the tag "${activeTag}"` : ""
              }.`
            : activeTag
              ? `No ${tab === "favorites" ? "favorites" : "recipes"} tagged "${activeTag}".`
              : "No favorites yet — tap the star on a recipe to add it here."}
        </p>
      )}

      {/* A brand-new account's very first view of this page — no query,
          not the favorites tab, genuinely zero recipes yet. Worth a real
          illustrated empty state rather than one dim sentence, since for
          a first-time visitor (right after the signup quiz) this is
          likely the very first "real" screen of the app they see. Both
          buttons at the top of the page already do the same thing — this
          just repeats them where the eye actually lands when the grid
          below is empty. */}
      {displayedRecipes.length === 0 && tab === "all" && !query && !activeTag && (
        <div className="wobble-a hand-shadow flex flex-col items-center gap-4 border-2 border-ink bg-cream-card px-6 py-12 text-center">
          <Mascot className="h-20 w-[70px]" />
          <div>
            <p className="font-display text-xl font-bold text-ink">
              Your recipe box is empty
            </p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-soft">
              Add one by hand, or tell AI what&apos;s in your pantry and
              let it suggest something.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/recipes/new"
              className="wobble-btn hand-shadow bg-tomato-400 px-5 py-2.5 font-display text-sm font-semibold text-cream transition hover:brightness-105"
            >
              + New recipe
            </Link>
            <Link
              href="/recipes/suggest"
              className="wobble-btn hand-shadow bg-citrus-400 px-5 py-2.5 font-display text-sm font-semibold text-ink transition hover:brightness-105"
            >
              &#10022; Suggest with AI
            </Link>
          </div>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {displayedRecipes.map((recipe, index) => {
          const isFavorited = favoritedIds.has(recipe.id);
          const accent = CARD_ACCENTS[index % CARD_ACCENTS.length] ?? "bg-tomato-400";
          const shadow = CARD_SHADOWS[index % CARD_SHADOWS.length] ?? "hand-shadow-tomato";
          const tilt = CARD_TILTS[index % CARD_TILTS.length] ?? "-rotate-1";
          const sourceBadge = SOURCE_BADGES[recipe.source];

          return (
            <li
              key={recipe.id}
              className={`wobble-a ${shadow} ${tilt} group relative overflow-hidden border-2 border-ink bg-cream-card p-4 transition duration-200 hover:-translate-y-1 hover:brightness-[1.03]`}
            >
              {/* Decorative doodles that rain down the card on hover, all
                  the way to the bottom — z-20 puts them above the text
                  block below instead of behind it, so they stay
                  visible (semi-transparent) over the title/description
                  rather than disappearing the moment they'd reach any
                  text. pointer-events-none keeps them purely visual: the
                  title link, edit/delete and favorite star underneath
                  still receive every click. The animation only exists
                  while .group:hover applies (see globals.css), so it
                  costs nothing otherwise and always starts fresh from
                  the top. */}
              <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
                {cardDoodles(index).map(({ key, Shape, sizeClass, style }) => (
                  <Shape
                    key={key}
                    className={`card-doodle-fall absolute top-0 ${sizeClass}`}
                    style={style}
                  />
                ))}
              </div>

              <div
                className={`wobble-b relative mb-3.5 flex h-32 items-center justify-center border-2 border-ink ${
                  recipe.image_url ? "" : accent
                }`}
              >
                {sourceBadge && (
                  <span
                    className={`absolute left-2 top-2 rounded-full border-2 border-ink px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${sourceBadge.className}`}
                  >
                    {sourceBadge.label}
                  </span>
                )}
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
                  // No uploaded photo — stand in with a goofy food
                  // character guessed from what the recipe is actually
                  // made of: its ingredient names first (e.g. "salmon"
                  // anywhere in the ingredient list gets the fish,
                  // "chicken thighs" gets the chicken), falling back to
                  // matching the title/description only for a recipe
                  // with no structured ingredients at all, then to the
                  // original tomato if nothing matches either. Same
                  // cursor-tracking eyes as the tomato mascot on every
                  // variant.
                  <FoodMascot
                    kind={inferFoodKind(
                      `${recipe.title} ${recipe.description ?? ""}`,
                      recipe.ingredientNames,
                    )}
                    className="h-16 w-14"
                  />
                )}
              </div>

              {/* The whole card opens the recipe, not just the words of
                  its title: the title link's ::after is stretched over
                  the entire card (it's positioned against the <li>,
                  the nearest `relative` ancestor — which is why this
                  text block itself isn't `relative` any more). The
                  card's other controls — the star, Edit, Delete — are
                  each `relative z-10` so they sit above that stretched
                  link and still get their own clicks. Still one real
                  link per card for keyboard and screen-reader users,
                  rather than a second, duplicate one wrapped around the
                  picture. */}
              <div className="bg-cream-card">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                    <Link
                      href={`/recipes/${recipe.id}`}
                      className="after:absolute after:inset-0 after:content-[''] group-hover:underline"
                    >
                      {recipe.title}
                    </Link>
                  </h2>
                  <div className="relative z-10 flex-none">
                    <FavoriteButton
                      recipeId={recipe.id}
                      initialFavorited={isFavorited}
                      toggleFavorite={toggleFavorite}
                      onToggle={handleToggle}
                      size="sm"
                    />
                  </div>
                </div>
                <div className="relative z-10 mt-1 flex w-fit flex-wrap items-center gap-x-3 gap-y-1">
                  <AddToPlannerButton
                    recipeId={recipe.id}
                    recipeTitle={recipe.title}
                    variant="card"
                  />
                  {recipe.isOwner && (
                    <>
                      <Link
                        href={`/recipes/${recipe.id}/edit`}
                        className="text-xs font-bold text-ink-soft underline underline-offset-2 transition hover:text-ink"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(recipe.id)}
                        className="text-xs font-bold text-ink-faint underline underline-offset-2 transition hover:text-tomato-600"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
                {recipe.description && (
                  <p className="mt-1 text-sm text-ink-soft">{recipe.description}</p>
                )}
                {/* First few tags only — a card is a preview; the full
                    set is on the recipe's own page. Same chip style as
                    there. */}
                {recipe.tags.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1">
                    {recipe.tags.slice(0, 3).map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full border-2 border-ink bg-cream-deep px-2 py-0.5 text-[11px] font-extrabold text-ink"
                      >
                        {tag}
                      </li>
                    ))}
                    {recipe.tags.length > 3 && (
                      <li className="px-1 py-0.5 text-[11px] font-extrabold text-ink-soft">
                        +{recipe.tags.length - 3}
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
