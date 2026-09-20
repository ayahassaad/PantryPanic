"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Called directly from the FavoriteButton client component (not as a
// <form action>), so it takes plain arguments instead of FormData — that
// works fine for a server action as long as the arguments are
// serializable, which a string and a boolean always are.
export async function toggleFavorite(recipeId: string, wasFavorited: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!recipeId) {
    return;
  }

  if (wasFavorited) {
    await supabase
      .from("recipe_favorites")
      .delete()
      .eq("owner_id", user.id)
      .eq("recipe_id", recipeId);
  } else {
    // Confirm the recipe actually exists and is visible to this user
    // before favoriting it — the recipe_favorites RLS insert policy only
    // checks that owner_id is the caller, not that recipe_id points to
    // something real or visible, so without this a crafted recipeId
    // could leave a dangling favorite pointing at a recipe this user was
    // never allowed to see (harmless — they still can't read its
    // content, RLS on `recipes` still blocks that — but there's no
    // reason to allow the junk row in the first place).
    const { data: recipe } = await supabase
      .from("recipes")
      .select("id")
      .eq("id", recipeId)
      .maybeSingle();

    if (recipe) {
      await supabase
        .from("recipe_favorites")
        .insert({ owner_id: user.id, recipe_id: recipeId });
    }
  }

  // Re-renders whichever page the toggle happened on with fresh data —
  // no redirect, since we want to land back exactly where we were,
  // including any ?q= search or ?tab= still in the URL.
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipeId}`);
}

// Only ever removes a recipe this user owns — RLS enforces owner_id =
// auth.uid() on delete too, so the .eq() below is a belt-and-suspenders
// check, not the actual security boundary.
//
// Returns a result instead of redirecting, so it works both called from
// a recipe card on the grid (where deleting should just make that card
// disappear in place — no navigation makes sense, we're already on the
// right page) and from deleteRecipe below (the detail page, where a
// redirect is the right call: once the recipe you were looking at is
// gone there's nothing left on that page to show).
export async function deleteRecipeCard(recipeId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", recipeId)
    .eq("owner_id", user.id);

  if (error) {
    return { error: "Couldn't delete that recipe." };
  }

  revalidatePath("/recipes");
  return {};
}

// Called from the detail page's DeleteRecipeButton, which relies on
// always getting a redirect() — that's what lets it tell "the delete
// actually failed" apart from "we're successfully navigating away".
export async function deleteRecipe(recipeId: string) {
  const { error } = await deleteRecipeCard(recipeId);

  if (error) {
    redirect(`/recipes/${recipeId}?error=${encodeURIComponent(error)}`);
  }

  redirect("/recipes");
}
