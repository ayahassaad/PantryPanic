"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  generateRecipeSuggestion,
  MissingApiKeyError,
  RecipeSuggestionUpstreamError,
} from "@/lib/anthropic/suggest-recipe";
import { RecipeSuggestionInputSchema } from "@pantry-panic/shared";

// Each call to Claude costs real money whether or not it succeeds, so cap
// how many suggestion attempts one user can make in a rolling window.
// Bump these if 10/day turns out to be too tight for normal use.
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_HOURS = 24;

export async function suggestRecipe(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const ingredientsRaw = (formData.get("ingredients") as string) ?? "";
  const ingredients = ingredientsRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const mealSlotRaw = (formData.get("mealSlot") as string) ?? "";
  const constraintsRaw = ((formData.get("constraints") as string) ?? "").trim();

  const parsed = RecipeSuggestionInputSchema.safeParse({
    ingredients,
    mealSlot: mealSlotRaw || undefined,
    constraints: constraintsRaw || undefined,
  });

  if (!parsed.success) {
    redirect(
      `/recipes/suggest?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Check what you entered and try again.",
      )}`,
    );
  }

  // Count this user's attempts in the last RATE_LIMIT_WINDOW_HOURS. Fail
  // OPEN if the count itself errors out (e.g. a transient DB hiccup) —
  // a rate limiter that's down shouldn't also take the whole feature down
  // with it, and we still log the attempt below either way.
  const since = new Date(
    Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();
  const { count: recentRequestCount, error: countError } = await supabase
    .from("ai_recipe_requests")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .gte("created_at", since);

  if (countError) {
    console.error(
      "[recipes/suggest] couldn't check AI rate limit, allowing request:",
      countError,
    );
  } else if ((recentRequestCount ?? 0) >= RATE_LIMIT_MAX_REQUESTS) {
    redirect(
      `/recipes/suggest?error=${encodeURIComponent(
        `You've hit the limit of ${RATE_LIMIT_MAX_REQUESTS} AI suggestions per day. Try again later, or add a recipe yourself in the meantime.`,
      )}`,
    );
  }

  // Log the attempt before calling Claude, not after — the point is to cap
  // how many times we *call* the API, and this way a slow or failed call
  // still counts against the limit instead of being freely retryable.
  const { error: logError } = await supabase
    .from("ai_recipe_requests")
    .insert({ owner_id: user.id });
  if (logError) {
    console.error("[recipes/suggest] failed to log AI request:", logError);
  }

  let result: Awaited<ReturnType<typeof generateRecipeSuggestion>>;
  try {
    result = await generateRecipeSuggestion(parsed.data);
  } catch (error) {
    console.error("[recipes/suggest] generateRecipeSuggestion failed:", error);
    const message =
      error instanceof MissingApiKeyError
        ? "Recipe suggestions aren't set up yet — ask whoever runs this app to add an Anthropic API key."
        : error instanceof RecipeSuggestionUpstreamError
          ? error.message
          : "Couldn't get a suggestion. Try again.";
    redirect(`/recipes/suggest?error=${encodeURIComponent(message)}`);
  }

  const { recipe, prompt } = result;

  // owner_id is set explicitly to this user — the RLS "insert" policy on
  // recipes only allows a row where owner_id = auth.uid(), so this can't
  // accidentally (or maliciously) create a recipe owned by anyone else.
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
    redirect(
      `/recipes/suggest?error=${encodeURIComponent(
        recipeError?.message ?? "Couldn't save that suggestion.",
      )}`,
    );
  }

  const allIngredients = [...recipe.usesFromPantry, ...recipe.additionalIngredients];
  if (allIngredients.length > 0) {
    const { error: ingredientsError } = await supabase.from("recipe_ingredients").insert(
      allIngredients.map((name, index) => ({
        recipe_id: saved.id,
        name,
        sort_order: index,
      })),
    );

    if (ingredientsError) {
      // The recipe itself saved fine — don't block the redirect over this,
      // just log it. Worst case the recipe shows up with no ingredient list.
      console.error("[recipes/suggest] failed to save ingredients:", ingredientsError);
    }
  }

  redirect(`/recipes/${saved.id}`);
}
