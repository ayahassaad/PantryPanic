"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createRecipe(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const tagsRaw = (formData.get("tags") as string) ?? "";
  const stepsRaw = (formData.get("steps") as string) ?? "";
  const ingredientsRaw = (formData.get("ingredients") as string) ?? "";

  if (!title) {
    redirect(`/recipes/new?error=${encodeURIComponent("A title is required.")}`);
  }

  const tags = tagsRaw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const steps = stepsRaw
    .split("\n")
    .map((step) => step.trim())
    .filter(Boolean);

  const ingredients = ingredientsRaw
    .split("\n")
    .map((ingredient) => ingredient.trim())
    .filter(Boolean);

  if (steps.length === 0) {
    redirect(
      `/recipes/new?error=${encodeURIComponent("Add at least one step.")}`,
    );
  }

  // owner_id is set explicitly to this user — the RLS "insert" policy on
  // recipes only allows a row where owner_id = auth.uid(), so this can't
  // accidentally (or maliciously) create a recipe owned by anyone else.
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .insert({
      owner_id: user.id,
      title,
      description: description || null,
      steps,
      tags,
      source: "user",
    })
    .select("id")
    .single();

  if (recipeError || !recipe) {
    redirect(
      `/recipes/new?error=${encodeURIComponent(
        recipeError?.message ?? "Couldn't save that recipe.",
      )}`,
    );
  }

  if (ingredients.length > 0) {
    const { error: ingredientsError } = await supabase
      .from("recipe_ingredients")
      .insert(
        ingredients.map((name, index) => ({
          recipe_id: recipe.id,
          name,
          sort_order: index,
        })),
      );

    if (ingredientsError) {
      redirect(
        `/recipes/new?error=${encodeURIComponent(
          `Recipe saved, but ingredients failed: ${ingredientsError.message}`,
        )}`,
      );
    }
  }

  redirect("/recipes");
}
