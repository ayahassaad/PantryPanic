"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Same caps as profile/actions.ts's ProfileUpdateSchema — this writes into
// the exact same columns, just from the first-run quiz instead of the
// preferences page, so the two need to agree on what's a valid value.
const OnboardingSchema = z.object({
  cuisinePreferences: z.array(z.string().trim().min(1).max(50)).max(20),
  dietaryPreferences: z.array(z.string().trim().min(1).max(50)).max(20),
  allergies: z.array(z.string().trim().min(1).max(50)).max(20),
  householdSize: z.coerce.number().int().min(1).max(20),
  unitSystem: z.enum(["metric", "imperial"]),
});

// The quiz is skippable at every step, so nothing here should ever be able
// to strand a new user who just wants to get to their dashboard — a
// validation failure (which shouldn't happen from the wizard's own chips
// and number input, but could from a malformed request) falls through to
// the dashboard exactly like a skip would, instead of showing an error on
// a page the user has no way back to.
export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const parsed = OnboardingSchema.safeParse({
    cuisinePreferences: formData.getAll("cuisinePreferences"),
    dietaryPreferences: formData.getAll("dietaryPreferences"),
    allergies: formData.getAll("allergies"),
    householdSize: formData.get("householdSize"),
    unitSystem: formData.get("unitSystem"),
  });

  // onboarding_completed_at is set here regardless of whether parsed
  // actually succeeded — this is what stops the dashboard (which now
  // gates on this column — see dashboard/page.tsx) from bouncing the
  // user right back to this same quiz forever if their answers happened
  // to fail validation.
  await supabase
    .from("profiles")
    .update({
      ...(parsed.success
        ? {
            cuisine_preferences: parsed.data.cuisinePreferences,
            dietary_preferences: parsed.data.dietaryPreferences,
            allergies: parsed.data.allergies,
            household_size: parsed.data.householdSize,
            unit_system: parsed.data.unitSystem,
          }
        : {}),
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  redirect("/dashboard");
}

// The "Skip for now" button — available on every step, not just the last
// one. Deliberately takes no data and saves nothing beyond the timestamp
// itself: a partial answer isn't better than no answer, and the whole
// point of "skippable" is that a new user can bail straight to their
// dashboard with zero friction. Still has to mark onboarding_completed_at
// — otherwise "skip" would just re-show the quiz on every future visit to
// the dashboard instead of actually skipping it for good.
export async function skipOnboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", user.id);
  }

  redirect("/dashboard");
}
