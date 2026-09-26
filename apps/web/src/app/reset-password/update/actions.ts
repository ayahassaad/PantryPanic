"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const UpdatePasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

// Reached only after clicking the emailed reset link, which exchanges a
// one-time code for a real session in auth/callback/route.ts before
// landing here — see requestPasswordReset in ../actions.ts for the rest
// of this flow.
//
// Deliberately does NOT ask for the current password the way
// profile/actions.ts's changePassword does: that check exists to stop a
// hijacked *existing* session from silently taking over the account, but
// the entire point of "forgot password" is recovering an account without
// knowing the current password — proving you control the email inbox (by
// following the emailed link) is the verification here instead.
export async function updatePasswordAfterReset(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?error=${encodeURIComponent(
        "That reset link expired or was already used. Request a new one.",
      )}`,
    );
  }

  const parsed = UpdatePasswordSchema.safeParse({
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    redirect(
      `/reset-password/update?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Check your new password and try again.",
      )}`,
    );
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });

  if (error) {
    redirect(
      `/reset-password/update?error=${encodeURIComponent(
        error.message ?? "Couldn't update your password.",
      )}`,
    );
  }

  // updateUser() succeeding leaves the recovery session in place as a
  // real, ordinary session — no separate sign-in step needed, so this can
  // go straight into the app rather than bouncing back through /login.
  redirect("/dashboard");
}
