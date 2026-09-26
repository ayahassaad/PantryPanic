import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Mascot } from "@/components/mascot";
import { updatePasswordAfterReset } from "./actions";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No session means this wasn't reached via a valid reset link — either
  // it was never clicked, or its one-time code was already used/expired.
  // Nothing to update in that case.
  if (!user) {
    redirect(
      `/login?error=${encodeURIComponent(
        "That reset link expired or was already used. Request a new one.",
      )}`,
    );
  }

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
      <div className="wobble-a hand-shadow border-2 border-ink bg-cream-card p-8">
        <Mascot className="mx-auto mb-5 h-16 w-14" />
        <p className="mb-1 text-center font-display text-xs font-semibold uppercase tracking-widest text-tomato-400">
          Almost done
        </p>
        <h1 className="mb-7 text-center font-display text-3xl font-bold text-ink">
          Choose a new password
        </h1>

        {error && (
          <p className="wobble-btn mb-6 border-2 border-ink bg-tomato-50 px-4 py-3 text-sm font-bold text-tomato-700">
            {error}
          </p>
        )}

        <form className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
            New password
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="rounded-xl border-2 border-ink-faint bg-cream-deep px-4 py-2.5 text-base text-ink outline-none focus:border-ink"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
            Confirm password
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="rounded-xl border-2 border-ink-faint bg-cream-deep px-4 py-2.5 text-base text-ink outline-none focus:border-ink"
            />
          </label>
          <button
            formAction={updatePasswordAfterReset}
            className="wobble-btn hand-shadow mt-2 bg-tomato-400 px-4 py-2.5 font-display text-sm font-semibold text-cream transition hover:brightness-105"
          >
            Update password
          </button>
        </form>
      </div>
    </main>
  );
}
