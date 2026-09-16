"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function toggleFavorite(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const recipeId = formData.get("recipeId") as string | null;
  const isFavorited = formData.get("isFavorited") === "true";

  if (!recipeId) {
    return;
  }

  if (isFavorited) {
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
  // including any ?q= search still in the URL.
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipeId}`);
}
