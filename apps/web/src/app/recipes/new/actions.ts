"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// These caps aren't about the "shape" of the data — a comma/newline
// separated field always parses down to *some* string array either way —
// they're about not letting a pasted wall of text turn into a multi-MB
// database row. Generous enough that no real recipe should ever hit them.
const NewRecipeSchema = z.object({
  title: z.string().trim().min(1, "A title is required.").max(200),
  description: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20),
  steps: z
    .array(z.string().trim().min(1).max(1000))
    .min(1, "Add at least one step.")
    .max(100),
  ingredients: z.array(z.string().trim().min(1).max(200)).max(100),
});

export async function createRecipe(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const titleRaw = (formData.get("title") as string) ?? "";
  const descriptionRaw = (formData.get("description") as string) ?? "";
  const tagsRaw = (formData.get("tags") as string) ?? "";
  const stepsRaw = (formData.get("steps") as string) ?? "";
  const ingredientsRaw = (formData.get("ingredients") as string) ?? "";

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

  const parsed = NewRecipeSchema.safeParse({
    title: titleRaw,
    description: descriptionRaw || undefined,
    tags,
    steps,
    ingredients,
  });

  if (!parsed.success) {
    redirect(
      `/recipes/new?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Check what you entered and try again.",
      )}`,
    );
  }

  const {
    title,
    description,
    tags: validTags,
    steps: validSteps,
    ingredients: validIngredients,
  } = parsed.data;

  // owner_id is set explicitly to this user — the RLS "insert" policy on
  // recipes only allows a row where owner_id = auth.uid(), so this can't
  // accidentally (or maliciously) create a recipe owned by anyone else.
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .insert({
      owner_id: user.id,
      title,
      description: description || null,
      steps: validSteps,
      tags: validTags,
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

  if (validIngredients.length > 0) {
    const { error: ingredientsError } = await supabase
      .from("recipe_ingredients")
      .insert(
        validIngredients.map((name, index) => ({
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
