"use client";

import { useState, useTransition, type FormEvent } from "react";
import { changePassword } from "./actions";

// Same reasoning as change-email-form.tsx's copy of this helper.
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

// Same two-step shape as ChangeEmailForm: pick the new password first,
// confirm with the current one in a popup right before it actually takes
// effect, rather than making "what do you want to change it to" and
// "prove it's you" look like one flat list of fields.
export function ChangePasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleContinue(event: FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setCurrentPassword("");
    setOpen(true);
  }

  function handleConfirm(event: FormEvent) {
    event.preventDefault();
    if (isPending || !currentPassword) return;
    setError(null);
    const formData = new FormData();
    formData.set("newPassword", newPassword);
    formData.set("confirmPassword", confirmPassword);
    formData.set("currentPassword", currentPassword);

    startTransition(async () => {
      try {
        await changePassword(formData);
      } catch (err) {
        if (isRedirectError(err)) {
          throw err;
        }
        setError("Couldn't update your password. Try again.");
      }
    });
  }

  return (
    <div>
      <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-ink-faint">
        Change password
      </h3>

      {error && !open && (
        <p className="wobble-btn mb-3 border-2 border-ink bg-tomato-50 px-3 py-2 text-xs font-bold text-tomato-700">
          {error}
        </p>
      )}

      <form
        onSubmit={handleContinue}
        className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3"
      >
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-bold text-ink-soft">
          New password
          <input
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
            minLength={8}
            className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none focus:border-blueberry-400"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-bold text-ink-soft">
          Confirm password
          <input
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
            minLength={8}
            className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none focus:border-blueberry-400"
          />
        </label>
        <button
          type="submit"
          className="wobble-btn border-2 border-ink bg-cream-deep px-4 py-2.5 font-display text-sm font-semibold text-ink transition hover:bg-cream"
        >
          Update password
        </button>
      </form>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => !isPending && setOpen(false)}
        >
          <div
            className="wobble-a hand-shadow w-full max-w-sm border-2 border-ink bg-cream-card p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="mb-1 font-display text-lg font-bold text-ink">
              Confirm your password
            </h2>
            <p className="mb-4 text-sm text-ink-soft">
              Enter your current password to finish changing it.
            </p>

            {error && (
              <p className="wobble-btn mb-4 border-2 border-ink bg-tomato-50 px-3 py-2 text-xs font-bold text-tomato-700">
                {error}
              </p>
            )}

            <form onSubmit={handleConfirm} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
                Current password
                <input
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  disabled={isPending}
                  className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none focus:border-blueberry-400"
                />
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => !isPending && setOpen(false)}
                  disabled={isPending}
                  className="wobble-btn border-2 border-ink bg-cream-card px-4 py-2.5 font-display text-sm font-semibold text-ink transition hover:bg-cream-deep disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !currentPassword}
                  className="wobble-btn hand-shadow bg-blueberry-400 px-4 py-2.5 font-display text-sm font-semibold text-cream transition hover:brightness-105 disabled:pointer-events-none disabled:opacity-60"
                >
                  {isPending ? "Updating…" : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
