"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const RequestResetSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

// Kicks off Supabase's own password-recovery flow. The emailed link reuses
// the exact same PKCE code-exchange route as email confirmation (see
// auth/callback/route.ts) — redirectTo here just points it at
// /reset-password/update afterward instead of /onboarding, via the same
// `next` query param that route already reads.
export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const parsed = RequestResetSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    redirect(
      `/reset-password?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Enter a valid email address.",
      )}`,
    );
  }

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/reset-password/update")}`,
  });

  if (error) {
    console.error("[reset-password] resetPasswordForEmail failed:", error);
  }

  // Deliberately the same message whether or not that email actually has
  // an account — confirming or denying an email's existence here would be
  // a real (if minor) privacy leak. Supabase's own resetPasswordForEmail
  // already doesn't reveal that either, so this just avoids contradicting
  // it with a different message on our end.
  redirect(
    `/reset-password?notice=${encodeURIComponent(
      "If that email has an account, we sent a link to reset your password.",
    )}`,
  );
}
