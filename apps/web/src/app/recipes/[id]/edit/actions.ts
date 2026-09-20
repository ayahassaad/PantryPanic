"use server";

import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { RecipeIngredientSchema } from "@pantry-panic/shared";
import { createClient } from "@/lib/supabase/server";

// Mirrors new/actions.ts's NewRecipeSchema — same caps, same reasoning
// (not about shape, just about not letting a pasted wall of text become
// a multi-MB row).
const EditRecipeSchema = z.object({
  title: z.string().trim().min(1, "A title is required.").max(200),
  description: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20),
  steps: z
    .array(z.string().trim().min(1).max(1000))
    .min(1, "Add at least one step.")
    .max(100),
});

const IngredientsSchema = z.array(RecipeIngredientSchema).max(100);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export async function updateRecipe(recipeId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // RLS would block an update to a recipe this user doesn't own anyway,
  // but checking up front means we can 404 cleanly instead of doing a
  // partial amount of work (like an image upload) before finding out.
  const { data: existing } = await supabase
    .from("recipes")
    .select("id, owner_id, image_url")
    .eq("id", recipeId)
    .maybeSingle<{ id: string; owner_id: string | null; image_url: string | null }>();

  if (!existing || existing.owner_id !== user.id) {
    notFound();
  }

  const titleRaw = (formData.get("title") as string) ?? "";
  const descriptionRaw = (formData.get("description") as string) ?? "";
  const tagsRaw = (formData.get("tags") as string) ?? "";
  const stepsRaw = (formData.get("steps") as string) ?? "";
  const imageFile = formData.get("image");
  const removeImage = formData.get("removeImage") === "true";

  const tags = tagsRaw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const steps = stepsRaw
    .split("\n")
    .map((step) => step.trim())
    .filter(Boolean);

  const parsed = EditRecipeSchema.safeParse({
    title: titleRaw,
    description: descriptionRaw || undefined,
    tags,
    steps,
  });

  if (!parsed.success) {
    redirect(
      `/recipes/${recipeId}/edit?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Check what you entered and try again.",
      )}`,
    );
  }

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
      `/recipes/${recipeId}/edit?error=${encodeURIComponent(
        "One of the ingredient rows doesn't look right. Check the quantity is a number.",
      )}`,
    );
  }

  const hasNewImage = imageFile instanceof File && imageFile.size > 0;

  if (hasNewImage) {
    if (imageFile.size > MAX_IMAGE_BYTES) {
      redirect(
        `/recipes/${recipeId}/edit?error=${encodeURIComponent(
          "That image is too large (5MB max).",
        )}`,
      );
    }
    if (!ALLOWED_IMAGE_TYPES.has(imageFile.type)) {
      redirect(
        `/recipes/${recipeId}/edit?error=${encodeURIComponent(
          "Images must be PNG, JPEG, WebP, or GIF.",
        )}`,
      );
    }
  }

  // Three cases: a new file was picked (upload it and swap the URL), the
  // "remove photo" box was checked with no new file (clear it), or
  // neither (leave whatever was already there alone).
  let imageUrl: string | null = existing.image_url;

  if (hasNewImage) {
    const extension = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("recipe-images")
      .upload(path, imageFile, { contentType: imageFile.type });

    if (uploadError) {
      redirect(
        `/recipes/${recipeId}/edit?error=${encodeURIComponent(
          `Couldn't upload that image: ${uploadError.message}`,
        )}`,
      );
    }

    imageUrl = supabase.storage.from("recipe-images").getPublicUrl(path).data.publicUrl;
  } else if (removeImage) {
    imageUrl = null;
  }

  const { title, description, tags: validTags, steps: validSteps } = parsed.data;
  const validIngredients = ingredientsParsed.data;

  const { error: updateError } = await supabase
    .from("recipes")
    .update({
      title,
      description: description || null,
      steps: validSteps,
      tags: validTags,
      image_url: imageUrl,
    })
    .eq("id", recipeId)
    .eq("owner_id", user.id);

  if (updateError) {
    redirect(
      `/recipes/${recipeId}/edit?error=${encodeURIComponent(
        updateError.message || "Couldn't save that recipe.",
      )}`,
    );
  }

  // Simplest correct way to keep ingredients in sync with a form that
  // freely adds/removes/reorders rows: replace the whole set rather than
  // trying to diff it row by row.
  const { error: deleteIngredientsError } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("recipe_id", recipeId);

  if (deleteIngredientsError) {
    redirect(
      `/recipes/${recipeId}/edit?error=${encodeURIComponent(
        `Recipe saved, but ingredients failed: ${deleteIngredientsError.message}`,
      )}`,
    );
  }

  if (validIngredients.length > 0) {
    const { error: ingredientsError } = await supabase.from("recipe_ingredients").insert(
      validIngredients.map((ingredient, index) => ({
        recipe_id: recipeId,
        name: ingredient.name,
        quantity: ingredient.quantity ?? null,
        unit: ingredient.unit ?? null,
        category: ingredient.category,
        sort_order: index,
      })),
    );

    if (ingredientsError) {
      redirect(
        `/recipes/${recipeId}/edit?error=${encodeURIComponent(
          `Recipe saved, but ingredients failed: ${ingredientsError.message}`,
        )}`,
      );
    }
  }

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipeId}`);
  redirect(`/recipes/${recipeId}`);
}
