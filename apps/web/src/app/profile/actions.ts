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

// Mirrors the avatars Storage bucket's own file_size_limit and
// allowed_mime_types (see the 20260919120000 migration) — checking here
// too just means a rejected image gets a friendly redirect instead of a
// raw Storage API error. Smaller cap than recipe images since an avatar
// never needs to be that large.
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

// Same spirit as the caps in recipes/new/actions.ts — not enforcing any
// particular shape, just keeping a pasted wall of text from turning into
// an oversized database row.
const ProfileUpdateSchema = z.object({
  fullName: z.string().trim().max(200).optional(),
  cuisinePreferences: z.array(z.string().trim().min(1).max(50)).max(20),
  dietaryPreferences: z.array(z.string().trim().min(1).max(50)).max(20),
  allergies: z.array(z.string().trim().min(1).max(50)).max(20),
  householdSize: z.coerce.number().int().min(1).max(20),
  unitSystem: z.enum(["metric", "imperial"]),
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
  const cuisinePreferences = parseList(formData.get("cuisinePreferences") as string | null);
  const dietaryPreferences = parseList(formData.get("dietaryPreferences") as string | null);
  const allergies = parseList(formData.get("allergies") as string | null);
  const avatarFile = formData.get("avatar");

  const parsed = ProfileUpdateSchema.safeParse({
    fullName: fullNameRaw.trim() || undefined,
    cuisinePreferences,
    dietaryPreferences,
    allergies,
    householdSize: formData.get("householdSize"),
    unitSystem: formData.get("unitSystem"),
  });

  if (!parsed.success) {
    redirect(
      `/profile?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Check what you entered and try again.",
      )}`,
    );
  }

  const {
    fullName,
    cuisinePreferences: validCuisinePreferences,
    dietaryPreferences: validDietaryPreferences,
    allergies: validAllergies,
    householdSize,
    unitSystem,
  } = parsed.data;

  const hasNewAvatar = avatarFile instanceof File && avatarFile.size > 0;

  if (hasNewAvatar) {
    if (avatarFile.size > MAX_AVATAR_BYTES) {
      redirect(`/profile?error=${encodeURIComponent("That image is too large (2MB max).")}`);
    }
    if (!ALLOWED_IMAGE_TYPES.has(avatarFile.type)) {
      redirect(
        `/profile?error=${encodeURIComponent("Images must be PNG, JPEG, WebP, or GIF.")}`,
      );
    }
  }

  let avatarUrl: string | undefined;

  if (hasNewAvatar) {
    // Stored under <user id>/<random name> — the Storage RLS policies
    // check that path prefix against auth.uid(), which is also what makes
    // this upload allowed in the first place. A fresh random name each
    // time (rather than overwriting a fixed path) sidesteps CDN/browser
    // caching showing a stale image right after a change.
    const extension = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, avatarFile, { contentType: avatarFile.type });

    if (uploadError) {
      redirect(
        `/profile?error=${encodeURIComponent(`Couldn't upload that image: ${uploadError.message}`)}`,
      );
    }

    avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }

  // The "update" RLS policy on profiles only allows a row where
  // id = auth.uid(), so this can only ever touch the caller's own row —
  // the .eq() below is belt-and-suspenders on top of that. avatar_url is
  // only included in the update when a new image was actually uploaded —
  // leaving the field out entirely (rather than setting it to some
  // existing value) means "Save" without picking a new photo can never
  // accidentally clear or overwrite the one already there.
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName || null,
      cuisine_preferences: validCuisinePreferences,
      dietary_preferences: validDietaryPreferences,
      allergies: validAllergies,
      household_size: householdSize,
      unit_system: unitSystem,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    })
    .eq("id", user.id);

  if (error) {
    redirect(
      `/profile?error=${encodeURIComponent(
        error.message ?? "Couldn't save your profile.",
      )}`,
    );
  }

  redirect(`/profile?success=${encodeURIComponent("Saved.")}`);
}

const ChangeEmailSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newEmail: z.string().trim().email("Enter a valid email address."),
});

// Supabase's default flow for this sends a confirmation link to the new
// address (and, depending on project settings, one to the old address
// too) — the email in auth.users doesn't actually change until that's
// clicked, so "Saved" here means "the request went through," not "it's
// done yet."
export async function changeEmail(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const parsed = ChangeEmailSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newEmail: formData.get("newEmail"),
  });

  if (!parsed.success) {
    redirect(
      `/profile?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Enter a valid email address.",
      )}`,
    );
  }

  if (!user.email) {
    redirect(
      `/profile?error=${encodeURIComponent(
        "Your account has no email on file to verify the current password against.",
      )}`,
    );
  }

  // Same reasoning as changePassword below: updateUser() trusts whatever
  // session is already active and won't ask for the password itself, so
  // without this, anyone with access to an already-signed-in session
  // could redirect the account's login email to somewhere they control.
  // Re-verify the current password first, same as a password change.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });

  if (verifyError) {
    redirect(`/profile?error=${encodeURIComponent("Current password is incorrect.")}`);
  }

  const { error } = await supabase.auth.updateUser({ email: parsed.data.newEmail });

  if (error) {
    redirect(
      `/profile?error=${encodeURIComponent(error.message ?? "Couldn't update your email.")}`,
    );
  }

  redirect(
    `/profile?success=${encodeURIComponent(
      "Check your new email for a confirmation link — it won't switch over until you click it.",
    )}`,
  );
}

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

export async function changePassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    redirect(
      `/profile?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Check your new password and try again.",
      )}`,
    );
  }

  if (!user.email) {
    redirect(
      `/profile?error=${encodeURIComponent(
        "Your account has no email on file to verify the current password against.",
      )}`,
    );
  }

  // supabase.auth.updateUser() doesn't ask for the current password itself
  // — it trusts whatever session is already active. Without this check,
  // anyone who got hold of an already-signed-in session (a shared or
  // unlocked device, a stolen session cookie) could lock the real owner
  // out just by submitting a new password, no proof of the old one
  // required. signInWithPassword re-validates the current password
  // against Supabase Auth directly; only on success do we go on to
  // actually change it. (It also refreshes the session to the one it just
  // verified, which is fine — it's the same user, same account.)
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });

  if (verifyError) {
    redirect(`/profile?error=${encodeURIComponent("Current password is incorrect.")}`);
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });

  if (error) {
    redirect(
      `/profile?error=${encodeURIComponent(error.message ?? "Couldn't update your password.")}`,
    );
  }

  redirect(`/profile?success=${encodeURIComponent("Password updated.")}`);
}

// Runs public.delete_own_account() — a security-definer Postgres function
// (see the 20260919120000 migration) that deletes this user's own
// auth.users row and nothing else's. The app itself never holds
// Supabase's service-role key (see lib/supabase/*.ts — every client here
// is the public anon key), so this RPC is what makes self-service account
// deletion possible at all without adding one. Deleting the auth.users
// row cascades to profiles, recipes, meal plans, shopping lists,
// favorites, etc. via the on-delete-cascade foreign keys already in place
// on every one of those tables — there's nothing left to clean up here.
export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("delete_own_account");

  if (error) {
    redirect(
      `/profile?error=${encodeURIComponent(error.message ?? "Couldn't delete your account.")}`,
    );
  }

  // The account (and the session tied to it) is already gone server-side
  // at this point — signOut() just clears the local session cookie so the
  // browser doesn't hold onto a token for a user that no longer exists.
  await supabase.auth.signOut();

  redirect(
    `/login?notice=${encodeURIComponent("Your account and all its data have been deleted.")}`,
  );
}
