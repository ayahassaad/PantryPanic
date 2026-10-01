"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MEAL_SLOTS, type MealSlot } from "@pantry-panic/shared";
import { createClient } from "@/lib/supabase/server";
import { assignMealPlanEntry } from "@/app/planner/actions";

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

const AddToPlannerSchema = z.object({
  recipeId: z.string().uuid(),
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealSlot: z.enum(MEAL_SLOTS),
});

// Called from AddToPlannerButton (a recipe card, or the recipe's own
// page) to put a recipe into a day's meal slot. The actual write is the
// planner's own assignMealPlanEntry — same validation, same "servings
// start at the household size" default — so a meal added from here is
// indistinguishable from one picked in the planner.
//
// The one thing added on top: assignMealPlanEntry upserts, i.e. quietly
// replaces whatever's already in the slot. That's fine in the planner,
// where you're looking straight at the slot you're replacing; from a
// recipe page you can't see the week at all, so unless `replace` is set
// an occupied slot is reported back (conflictTitle) instead of
// overwritten, and the dialog asks first.
export async function addRecipeToPlanner(
  recipeId: string,
  planDate: string,
  mealSlot: MealSlot,
  replace: boolean,
): Promise<{ error?: string; conflictTitle?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const parsed = AddToPlannerSchema.safeParse({ recipeId, planDate, mealSlot });
  if (!parsed.success) {
    return { error: "Couldn't add that to the planner." };
  }

  if (!replace) {
    const { data: existing, error: existingError } = await supabase
      .from("meal_plan_entries")
      .select("id, recipe:recipes(title)")
      .eq("user_id", user.id)
      .eq("plan_date", parsed.data.planDate)
      .eq("meal_slot", parsed.data.mealSlot)
      .maybeSingle<{ id: string; recipe: { title: string } | null }>();

    if (existingError) {
      return { error: "Couldn't add that to the planner." };
    }
    if (existing) {
      return { conflictTitle: existing.recipe?.title ?? "another meal" };
    }
  }

  const result = await assignMealPlanEntry(
    parsed.data.recipeId,
    parsed.data.planDate,
    parsed.data.mealSlot,
  );
  if (!result.entryId) {
    return { error: "Couldn't add that to the planner." };
  }

  return {};
}
