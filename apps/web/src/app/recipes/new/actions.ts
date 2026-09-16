"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { RecipeIngredientSchema } from "@pantry-panic/shared";
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
});

const IngredientsSchema = z.array(RecipeIngredientSchema).max(100);

// Mirrors the recipe-images Storage bucket's own file_size_limit and
// allowed_mime_types (see the 20260916120000 migration) — checking here
// too just means a rejected image gets a friendly redirect instead of a
// raw Storage API error.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

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
  const imageFile = formData.get("image");

  const tags = tagsRaw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const steps = stepsRaw
    .split("\n")
    .map((step) => step.trim())
    .filter(Boolean);

  const parsed = NewRecipeSchema.safeParse({
    title: titleRaw,
    description: descriptionRaw || undefined,
    tags,
    steps,
  });

  if (!parsed.success) {
    redirect(
      `/recipes/new?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Check what you entered and try again.",
      )}`,
    );
  }

  // The ingredient-rows client component submits four parallel arrays
  // (same field name repeated once per row) — getAll() on each comes back
  // in row order, so zipping them back together by index reconstructs
  // each row exactly as it was on screen.
  const ingredientNames = formData.getAll("ingredientName") as string[];
  const ingredientQuantities = formData.getAll("ingredientQuantity") as string[];
  const ingredientUnits = formData.getAll("ingredientUnit") as string[];
  const ingredientCategories = formData.getAll("ingredientCategory") as string[];

  const ingredientCandidates = ingredientNames
    .map((name, index) => ({
      name: name?.trim() ?? "",
      quantityRaw: ingredientQuantities[index]?.trim() ?? "",
      unit: ingredientUnits[index]?.trim() || undefined,
      category: ingredientCategories[index],
    }))
    // A row with no name typed in yet (including the form's starting
    // empty row) just gets dropped rather than rejected.
    .filter((row) => row.name.length > 0);

  const ingredientsParsed = IngredientsSchema.safeParse(
    ingredientCandidates.map((row) => ({
      name: row.name,
      quantity: row.quantityRaw ? Number(row.quantityRaw) : undefined,
      unit: row.unit,
      category: row.category,
    })),
  );

  if (!ingredientsParsed.success) {
    redirect(
      `/recipes/new?error=${encodeURIComponent(
        "One of the ingredient rows doesn't look right — check the quantity is a number.",
      )}`,
    );
  }

  const hasImage = imageFile instanceof File && imageFile.size > 0;

  if (hasImage) {
    if (imageFile.size > MAX_IMAGE_BYTES) {
      redirect(
        `/recipes/new?error=${encodeURIComponent(
          "That image is too large — 5MB max.",
        )}`,
      );
    }
    if (!ALLOWED_IMAGE_TYPES.has(imageFile.type)) {
      redirect(
        `/recipes/new?error=${encodeURIComponent(
          "Images must be PNG, JPEG, WebP, or GIF.",
        )}`,
      );
    }
  }

  let imageUrl: string | null = null;

  if (hasImage) {
    // Stored under <user id>/<random name> — the Storage RLS policies
    // check that path prefix against auth.uid(), so this is also what
    // makes this upload allowed in the first place.
    const extension = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("recipe-images")
      .upload(path, imageFile, { contentType: imageFile.type });

    if (uploadError) {
      redirect(
        `/recipes/new?error=${encodeURIComponent(
          `Couldn't upload that image: ${uploadError.message}`,
        )}`,
      );
    }

    imageUrl = supabase.storage.from("recipe-images").getPublicUrl(path).data.publicUrl;
  }

  const { title, description, tags: validTags, steps: validSteps } = parsed.data;
  const validIngredients = ingredientsParsed.data;

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
      image_url: imageUrl,
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
    const { error: ingredientsError } = await supabase.from("recipe_ingredients").insert(
      validIngredients.map((ingredient, index) => ({
        recipe_id: recipe.id,
        name: ingredient.name,
        quantity: ingredient.quantity ?? null,
        unit: ingredient.unit ?? null,
        category: ingredient.category,
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
