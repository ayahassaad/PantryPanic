"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MEAL_SLOTS, type MealSlot } from "@pantry-panic/shared";
import { addDays, toISODate } from "@/lib/week";
import { createClient } from "@/lib/supabase/server";

const AssignEntrySchema = z.object({
  recipeId: z.string().uuid(),
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealSlot: z.enum(MEAL_SLOTS),
});

// Called directly from PlannerCell's recipe picker (not as a <form
// action>), same reasoning as the recipe favorites toggle — assigning a
// meal needs to update the cell the instant a recipe is picked, using the
// id/servings the server actually wrote, rather than waiting on a full
// form submission + redirect. Returns the new entry's id and starting
// servings so the cell can show them without a second round trip.
export async function assignMealPlanEntry(
  recipeId: string,
  planDate: string,
  mealSlot: MealSlot,
): Promise<{ error?: string; entryId?: string; servings?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const parsed = AssignEntrySchema.safeParse({ recipeId, planDate, mealSlot });
  if (!parsed.success) {
    return { error: "Couldn't add that meal." };
  }

  // Confirm the recipe is actually visible to this user before assigning
  // it — same reasoning as the favorites toggle: without this, a crafted
  // recipeId could create an entry pointing at a recipe this user can't
  // see, which would then render with nothing to show for no real reason.
  const { data: recipe } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", parsed.data.recipeId)
    .maybeSingle();

  if (!recipe) {
    return { error: "Couldn't add that meal." };
  }

  // New meals start at the household's default serving size (see
  // profiles.household_size) — 2 if it's somehow never been set — and can
  // be nudged up or down afterward with the +/- stepper on the cell.
  const { data: profile } = await supabase
    .from("profiles")
    .select("household_size")
    .eq("id", user.id)
    .maybeSingle();
  const servings = profile?.household_size ?? 2;

  // Upsert on the (user_id, plan_date, meal_slot) unique constraint —
  // setting a new recipe on an already-filled slot replaces it instead
  // of erroring.
  const { data: upserted, error } = await supabase
    .from("meal_plan_entries")
    .upsert(
      {
        user_id: user.id,
        recipe_id: parsed.data.recipeId,
        plan_date: parsed.data.planDate,
        meal_slot: parsed.data.mealSlot,
        servings,
      },
      { onConflict: "user_id,plan_date,meal_slot" },
    )
    .select("id, servings")
    .single();

  if (error || !upserted) {
    return { error: "Couldn't add that meal." };
  }

  revalidatePath("/planner");
  return { entryId: upserted.id, servings: upserted.servings };
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

const UpdateServingsSchema = z.object({
  entryId: z.string().uuid(),
  servings: z.number().int().min(1).max(20),
});

// Called directly from PlannerCell's +/- stepper (not as a <form
// action>) — nudging servings up or down is exactly the kind of
// click-repeatedly-and-expect-it-instant interaction the favorites star
// and the remove button already use, so this follows the same pattern.
export async function updateMealPlanServings(entryId: string, servings: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const parsed = UpdateServingsSchema.safeParse({ entryId, servings });
  if (!parsed.success) {
    return;
  }

  // The RLS "update" policy on meal_plan_entries already only allows
  // updating rows where user_id = auth.uid() — the .eq() below is
  // belt-and-suspenders on top of that.
  await supabase
    .from("meal_plan_entries")
    .update({ servings: parsed.data.servings })
    .eq("id", parsed.data.entryId)
    .eq("user_id", user.id);

  revalidatePath("/planner");
}

interface CopyableEntry {
  recipe_id: string;
  plan_date: string;
  meal_slot: MealSlot;
  servings: number;
}

const CopyWeekSchema = z.object({
  fromWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Duplicates every meal assigned in the given week into the following
// week — same day-of-week, same slot, same recipe and servings — so
// repeating a week you liked doesn't mean rebuilding it from scratch.
// Upserts on the same (user_id, plan_date, meal_slot) constraint
// assignMealPlanEntry uses, so it overwrites whatever's already in next
// week's matching slots rather than erroring or duplicating; the button
// that calls this warns about that before it does.
export async function copyWeekForward(
  fromWeekStart: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const parsed = CopyWeekSchema.safeParse({ fromWeekStart });
  if (!parsed.success) {
    return { error: "Couldn't copy that week." };
  }

  const fromStart = new Date(`${parsed.data.fromWeekStart}T00:00:00Z`);
  const fromEndISO = toISODate(addDays(fromStart, 6));

  const { data: entries, error: fetchError } = await supabase
    .from("meal_plan_entries")
    .select("recipe_id, plan_date, meal_slot, servings")
    .eq("user_id", user.id)
    .gte("plan_date", parsed.data.fromWeekStart)
    .lte("plan_date", fromEndISO)
    .returns<CopyableEntry[]>();

  if (fetchError) {
    return { error: "Couldn't copy that week." };
  }
  if (!entries || entries.length === 0) {
    return { error: "That week is empty — nothing to copy." };
  }

  const rows = entries.map((entry) => ({
    user_id: user.id,
    recipe_id: entry.recipe_id,
    plan_date: toISODate(addDays(new Date(`${entry.plan_date}T00:00:00Z`), 7)),
    meal_slot: entry.meal_slot,
    servings: entry.servings,
  }));

  const { error: upsertError } = await supabase
    .from("meal_plan_entries")
    .upsert(rows, { onConflict: "user_id,plan_date,meal_slot" });

  if (upsertError) {
    return { error: "Couldn't copy that week." };
  }

  revalidatePath("/planner");
  return {};
}
