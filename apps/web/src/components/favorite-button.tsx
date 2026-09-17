"use client";

import { useState, useTransition } from "react";

// A Next.js redirect() (e.g. "not logged in any more") works by throwing
// a special error with a digest starting "NEXT_REDIRECT" — Next's own
// runtime catches that to perform the navigation. If our catch block
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

const SIZE_CLASSES = { sm: "text-xl", lg: "text-3xl" };

interface FavoriteButtonProps {
  recipeId: string;
  initialFavorited: boolean;
  toggleFavorite: (recipeId: string, wasFavorited: boolean) => Promise<void>;
  size?: keyof typeof SIZE_CLASSES;
  // Fires the instant the visible star flips (and again if a failed save
  // has to flip it back) — lets a parent list (e.g. the Favorites tab)
  // keep its own copy of "which recipes are favorited" in sync without
  // waiting on a server round trip either.
  onToggle?: (recipeId: string, isFavorited: boolean) => void;
}

// Flips the star the instant you click it, rather than waiting on the
// round trip to Supabase — `toggleFavorite` (a server action) still runs
// in the background and is what actually persists it, but the visible
// state lives here so there's no lag between clicking and seeing it.
export function FavoriteButton({
  recipeId,
  initialFavorited,
  toggleFavorite,
  size = "sm",
  onToggle,
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [, startTransition] = useTransition();

  function handleClick() {
    const wasFavorited = isFavorited;
    setIsFavorited(!wasFavorited);
    onToggle?.(recipeId, !wasFavorited);

    startTransition(async () => {
      try {
        await toggleFavorite(recipeId, wasFavorited);
      } catch (error) {
        if (isRedirectError(error)) {
          throw error;
        }
        // The server call failed — put the star back rather than leave
        // the UI claiming something that didn't actually save.
        setIsFavorited(wasFavorited);
        onToggle?.(recipeId, wasFavorited);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={isFavorited}
      className={`${SIZE_CLASSES[size]} flex-none leading-none transition-transform active:scale-90 ${
        isFavorited ? "text-citrus-600" : "text-ink-faint hover:text-ink-soft"
      }`}
    >
      {isFavorited ? "★" : "☆"}
    </button>
  );
}
