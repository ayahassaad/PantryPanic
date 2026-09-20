"use server";

// Two server actions that back the "New recipe" / "Ask AI" tabs of
// RecipeModal (see recipe-modal.tsx) — the planner's own way to add a
// recipe without leaving the meal box you're filling.
//
// These deliberately duplicate most of the parsing/upload/save logic
// already in recipes/new/actions.ts and recipes/suggest/actions.ts rather
// than importing from them, for one reason: those two return void and
// communicate success/failure entirely through redirect() (to /recipes,
// or back to the same page with ?error=...). A modal that's meant to stay
// open on the planner and hand the freshly-created entry back to
// PlannerCell can't work that way — it needs a plain return value
// ({ error } or { entry }) it can await and react to, the same pattern
// every other planner action (assignMealPlanEntry, etc.) already uses.
// Splitting the shared bits out into helpers both sides call felt more
// disruptive than it was worth for two fairly short flows — if the
// standalone /recipes/new or /recipes/suggest forms change, mirror the
// change here too.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  MEAL_SLOTS,
  RecipeIngredientSchema,
  RecipeSuggestionInputSchema,
  type MealSlot,
} from "@pantry-panic/shared";
import { createClient } from "@/lib/supabase/server";
import {
  generateRecipeSuggestion,
  MissingApiKeyError,
  RecipeSuggestionUpstreamError,
} from "@/lib/anthropic/suggest-recipe";

export interface AssignedEntry {
  id: string;
  recipeId: string;
  recipeTitle: string;
  servings: number;
}

type ActionResult = { error?: string; entry?: AssignedEntry };

const PlanTargetSchema = z.object({
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealSlot: z.enum(MEAL_SLOTS),
});

// Shared tail end of both actions below: once a recipe row exists, drop it
// straight into the plan slot the modal was opened from. Same upsert
// assignMealPlanEntry uses, so filling an already-planned slot replaces it
// rather than erroring, and it starts at the household's default serving
// size just like picking an existing recipe from the dropdown does.
async function assignRecipeToSlot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  recipeId: string,
  recipeTitle: string,
  planDate: string,
  mealSlot: MealSlot,
): Promise<ActionResult> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("household_size")
    .eq("id", userId)
    .maybeSingle();
  const servings = profile?.household_size ?? 2;

  const { data: upserted, error } = await supabase
    .from("meal_plan_entries")
    .upsert(
      {
        user_id: userId,
        recipe_id: recipeId,
        plan_date: planDate,
        meal_slot: mealSlot,
        servings,
      },
      { onConflict: "user_id,plan_date,meal_slot" },
    )
    .select("id, servings")
    .single();

  if (error || !upserted) {
    // The recipe itself is saved fine at this point (it's in their
    // library either way) — just couldn't slot it into this cell.
    return { error: "Recipe saved, but couldn't add it to the plan. Find it under Recipes." };
  }

  revalidatePath("/planner");
  return { entry: { id: upserted.id, recipeId, recipeTitle, servings: upserted.servings } };
}

// Mirrors createRecipe in recipes/new/actions.ts — same validation, same
// optional image upload to the recipe-images bucket — but returns the
// result instead of redirecting, and assigns the new recipe to the given
// date/slot as its last step.
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
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function createRecipeAndAssign(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const target = PlanTargetSchema.safeParse({
    planDate: formData.get("planDate"),
    mealSlot: formData.get("mealSlot"),
  });
  if (!target.success) {
    return { error: "Couldn't tell which meal box this was for. Try again." };
  }

  const titleRaw = (formData.get("title") as string) ?? "";
  const descriptionRaw = (formData.get("description") as string) ?? "";
  const tagsRaw = (formData.get("tags") as string) ?? "";
  const stepsRaw = (formData.get("steps") as string) ?? "";
  const imageFile = formData.get("image");

  const tags = tagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean);
  const steps = stepsRaw.split("\n").map((step) => step.trim()).filter(Boolean);

  const parsed = NewRecipeSchema.safeParse({
    title: titleRaw,
    description: descriptionRaw || undefined,
    tags,
    steps,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check what you entered and try again." };
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
    return { error: "One of the ingredient rows doesn't look right. Check the quantity is a number." };
  }

  const hasImage = imageFile instanceof File && imageFile.size > 0;
  if (hasImage) {
    if (imageFile.size > MAX_IMAGE_BYTES) {
      return { error: "That image is too large (5MB max)." };
    }
    if (!ALLOWED_IMAGE_TYPES.has(imageFile.type)) {
      return { error: "Images must be PNG, JPEG, WebP, or GIF." };
    }
  }

  let imageUrl: string | null = null;
  if (hasImage) {
    const extension = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("recipe-images")
      .upload(path, imageFile, { contentType: imageFile.type });
    if (uploadError) {
      return { error: `Couldn't upload that image: ${uploadError.message}` };
    }
    imageUrl = supabase.storage.from("recipe-images").getPublicUrl(path).data.publicUrl;
  }

  const { title, description, tags: validTags, steps: validSteps } = parsed.data;
  const validIngredients = ingredientsParsed.data;

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
    return { error: recipeError?.message ?? "Couldn't save that recipe." };
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
      return { error: `Recipe saved, but ingredients failed: ${ingredientsError.message}` };
    }
  }

  return assignRecipeToSlot(supabase, user.id, recipe.id, title, target.data.planDate, target.data.mealSlot);
}

// Mirrors suggestRecipe in recipes/suggest/actions.ts — same rate limit,
// same Claude call, same save — but returns the result instead of
// redirecting, and assigns the suggestion to the given date/slot.
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_HOURS = 24;

export async function suggestRecipeAndAssign(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const target = PlanTargetSchema.safeParse({
    planDate: formData.get("planDate"),
    mealSlot: formData.get("mealSlot"),
  });
  if (!target.success) {
    return { error: "Couldn't tell which meal box this was for. Try again." };
  }

  const ingredientsRaw = (formData.get("ingredients") as string) ?? "";
  const ingredients = ingredientsRaw.split("\n").map((line) => line.trim()).filter(Boolean);
  const mealSlotRaw = (formData.get("aiMealSlot") as string) ?? "";
  const constraintsRaw = ((formData.get("constraints") as string) ?? "").trim();

  const { data: profile } = await supabase
    .from("profiles")
    .select("dietary_preferences, allergies, unit_system")
    .eq("id", user.id)
    .maybeSingle<{
      dietary_preferences: string[];
      allergies: string[];
      unit_system: "metric" | "imperial";
    }>();

  const parsed = RecipeSuggestionInputSchema.safeParse({
    ingredients,
    mealSlot: mealSlotRaw || undefined,
    constraints: constraintsRaw || undefined,
    dietaryPreferences: profile?.dietary_preferences?.length ? profile.dietary_preferences : undefined,
    allergies: profile?.allergies?.length ? profile.allergies : undefined,
    unitSystem: profile?.unit_system,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check what you entered and try again." };
  }

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { count: recentRequestCount, error: countError } = await supabase
    .from("ai_recipe_requests")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .gte("created_at", since);

  if (countError) {
    console.error("[planner/recipe-actions] couldn't check AI rate limit, allowing request:", countError);
  } else if ((recentRequestCount ?? 0) >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      error: `You've hit the limit of ${RATE_LIMIT_MAX_REQUESTS} AI suggestions per day. Try again later, or add a recipe yourself in the meantime.`,
    };
  }

  const { error: logError } = await supabase.from("ai_recipe_requests").insert({ owner_id: user.id });
  if (logError) {
    console.error("[planner/recipe-actions] failed to log AI request:", logError);
  }

  let result: Awaited<ReturnType<typeof generateRecipeSuggestion>>;
  try {
    result = await generateRecipeSuggestion(parsed.data);
  } catch (error) {
    console.error("[planner/recipe-actions] generateRecipeSuggestion failed:", error);
    const message =
      error instanceof MissingApiKeyError
        ? "Recipe suggestions aren't set up yet. Ask whoever runs this app to add an Anthropic API key."
        : error instanceof RecipeSuggestionUpstreamError
          ? error.message
          : "Couldn't get a suggestion. Try again.";
    return { error: message };
  }

  const { recipe, prompt } = result;

  const { data: saved, error: recipeError } = await supabase
    .from("recipes")
    .insert({
      owner_id: user.id,
      title: recipe.title,
      description: recipe.description,
      steps: recipe.steps,
      tags: parsed.data.mealSlot ? [parsed.data.mealSlot] : [],
      source: "ai",
      ai_prompt: prompt,
    })
    .select("id")
    .single();
  if (recipeError || !saved) {
    return { error: recipeError?.message ?? "Couldn't save that suggestion." };
  }

  if (recipe.ingredients.length > 0) {
    const { error: ingredientsError } = await supabase.from("recipe_ingredients").insert(
      recipe.ingredients.map((ingredient, index) => ({
        recipe_id: saved.id,
        name: ingredient.name,
        quantity: ingredient.quantity ?? null,
        unit: ingredient.unit ?? null,
        category: ingredient.category,
        sort_order: index,
      })),
    );
    if (ingredientsError) {
      console.error("[planner/recipe-actions] failed to save ingredients:", ingredientsError);
    }
  }

  return assignRecipeToSlot(supabase, user.id, saved.id, recipe.title, target.data.planDate, target.data.mealSlot);
}
