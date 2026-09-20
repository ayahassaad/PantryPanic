"use client";

import type { CSSProperties } from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
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
import { deleteRecipeCard, toggleFavorite } from "./actions";

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

interface RecipeGridProps {
  recipes: RecipeListItem[];
  favoritedIds: string[];
  query: string;
  initialTab: "all" | "favorites";
}

// Tabs + the card grid, as one client component so switching between
// "All" and "Favorites" is an instant local re-render instead of a full
// round trip back to the server (which is what made it feel laggy when
// this was a <Link href="/recipes?tab=..."> navigation). Everything it
// needs — the recipe list and which ones are favorited — is fetched once
// by the server page and handed down as plain props.
export function RecipeGrid({ recipes, favoritedIds: initialFavoritedIds, query, initialTab }: RecipeGridProps) {
  const [tab, setTab] = useState<"all" | "favorites">(initialTab);
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
  const displayedRecipes = (
    tab === "favorites" ? recipes.filter((recipe) => favoritedIds.has(recipe.id)) : recipes
  ).filter((recipe) => !deletedIds.has(recipe.id));

  return (
    <>
      <div className="mb-6 flex gap-2">
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
      </div>

      {displayedRecipes.length === 0 && (
        <p className="text-ink-soft">
          {tab === "favorites"
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
                  reach any text instead of ever overlapping it. The
                  animation only exists while .group:hover applies (see
                  globals.css), so it costs nothing otherwise and always
                  starts fresh from the top. */}
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
                    onToggle={handleToggle}
                    size="sm"
                  />
                </div>
                {recipe.isOwner && (
                  <div className="mt-1 flex items-center gap-3">
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
                  </div>
                )}
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
    </>
  );
}
