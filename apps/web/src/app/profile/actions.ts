"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Splits a comma-separated field ("vegetarian, gluten-free") into a clean
// array, the same way recipes/new does for its tags field — trimmed,
// empty entries dropped, so a trailing comma or extra whitespace doesn't
// leave junk in the array.
function parseList(raw: string | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Same spirit as the caps in recipes/new/actions.ts — not enforcing any
// particular shape, just keeping a pasted wall of text from turning into
// an oversized database row.
const ProfileUpdateSchema = z.object({
  fullName: z.string().trim().max(200).optional(),
  dietaryPreferences: z.array(z.string().trim().min(1).max(50)).max(20),
  allergies: z.array(z.string().trim().min(1).max(50)).max(20),
});

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fullNameRaw = (formData.get("fullName") as string) ?? "";
  const dietaryPreferences = parseList(formData.get("dietaryPreferences") as string | null);
  const allergies = parseList(formData.get("allergies") as string | null);

  const parsed = ProfileUpdateSchema.safeParse({
    fullName: fullNameRaw.trim() || undefined,
    dietaryPreferences,
    allergies,
  });

  if (!parsed.success) {
    redirect(
      `/profile?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Check what you entered and try again.",
      )}`,
    );
  }

  const { fullName, dietaryPreferences: validDietaryPreferences, allergies: validAllergies } =
    parsed.data;

  // The "update" RLS policy on profiles only allows a row where
  // id = auth.uid(), so this can only ever touch the caller's own row —
  // the .eq() below is belt-and-suspenders on top of that.
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName || null,
      dietary_preferences: validDietaryPreferences,
      allergies: validAllergies,
    })
    .eq("id", user.id);

  if (error) {
    redirect(
      `/profile?error=${encodeURIComponent(
        error.message ?? "Couldn't save your profile.",
      )}`,
    );
  }

  redirect("/profile?success=1");
}
