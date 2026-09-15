"use server";

import { redirect } from "next/navigation";
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

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fullNameRaw = (formData.get("fullName") as string) ?? "";
  const fullName = fullNameRaw.trim();

  const dietaryPreferences = parseList(formData.get("dietaryPreferences") as string | null);
  const allergies = parseList(formData.get("allergies") as string | null);

  // The "update" RLS policy on profiles only allows a row where
  // id = auth.uid(), so this can only ever touch the caller's own row —
  // the .eq() below is belt-and-suspenders on top of that.
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName || null,
      dietary_preferences: dietaryPreferences,
      allergies,
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
