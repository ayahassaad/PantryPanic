"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MEAL_SLOTS } from "@pantry-panic/shared";
import { createClient } from "@/lib/supabase/server";

const SetEntrySchema = z.object({
  recipeId: z.string().uuid(),
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealSlot: z.enum(MEAL_SLOTS),
});

export async function setMealPlanEntry(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const parsed = SetEntrySchema.safeParse({
    recipeId: formData.get("recipeId"),
    planDate: formData.get("planDate"),
    mealSlot: formData.get("mealSlot"),
  });

  if (!parsed.success) {
    // The form only ever submits valid values, so failing here means a
    // tampered request, not a normal mistake — nothing useful to show on
    // a redirect, so just bail without writing anything.
    return;
  }

  const { recipeId, planDate, mealSlot } = parsed.data;

  // Confirm the recipe is actually visible to this user before assigning
  // it — same reasoning as the favorites toggle: without this, a crafted
  // recipeId could create an entry pointing at a recipe this user can't
  // see, which would then render with nothing to show for no real reason.
  const { data: recipe } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", recipeId)
    .maybeSingle();

  if (!recipe) {
    return;
  }

  // Upsert on the (user_id, plan_date, meal_slot) unique constraint —
  // setting a new recipe on an already-filled slot replaces it instead
  // of erroring.
  await supabase.from("meal_plan_entries").upsert(
    {
      user_id: user.id,
      recipe_id: recipeId,
      plan_date: planDate,
      meal_slot: mealSlot,
      servings: 1,
    },
    { onConflict: "user_id,plan_date,meal_slot" },
  );

  revalidatePath("/planner");
}

// Called directly from PlannerCell (not as a <form action>), so it takes
// a plain argument instead of FormData — same reasoning as the recipe
// favorites toggle.
export async function removeMealPlanEntry(entryId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!entryId) {
    return;
  }

  // The RLS "delete" policy on meal_plan_entries already only allows
  // deleting rows where user_id = auth.uid() — the .eq() below is
  // belt-and-suspenders on top of that.
  await supabase
    .from("meal_plan_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", user.id);

  revalidatePath("/planner");
}
