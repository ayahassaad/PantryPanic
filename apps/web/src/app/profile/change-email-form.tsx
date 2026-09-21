"use client";

import { useState, useTransition, type FormEvent } from "react";
import { changeEmail } from "./actions";

interface ChangeEmailFormProps {
  currentEmail: string;
}

// A Next.js redirect() throws a special error (digest starting
// "NEXT_REDIRECT") — same reasoning as fill-week-button.tsx and
// delete-account-button.tsx: let it through rather than swallowing it as
// a normal error, since changeEmail always ends in a redirect() either
// way (back to /profile with ?success= or ?error=).
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

// Two steps instead of one row of inputs: typing the new email and
// confirming with a password are different moments, and a password field
// sitting right next to "what do you want to change it to" read like the
// form was asking two unrelated questions at once. The password only
// shows up once there's an actual change to confirm — a small popup,
// same shape as change-password-form.tsx (deliberately not shared: the
// two forms differ enough — email format vs. a match check — that a
// shared abstraction would mostly be indirection).
export function ChangeEmailForm({ currentEmail }: ChangeEmailFormProps) {
  const [newEmail, setNewEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleContinue(event: FormEvent) {
    event.preventDefault();
    if (!newEmail.trim()) return;
    setError(null);
    setPassword("");
    setOpen(true);
  }

  function handleConfirm(event: FormEvent) {
    event.preventDefault();
    if (isPending || !password) return;
    setError(null);
    const formData = new FormData();
    formData.set("newEmail", newEmail);
    formData.set("currentPassword", password);

    startTransition(async () => {
      try {
        await changeEmail(formData);
      } catch (err) {
        if (isRedirectError(err)) {
          throw err;
        }
        setError("Couldn't update your email. Try again.");
      }
    });
  }

  return (
    <div>
      <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-ink-faint">
        Change email
      </h3>
      <form
        onSubmit={handleContinue}
        className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3"
      >
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-bold text-ink-soft">
          New email
          <input
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            type="email"
            placeholder={currentEmail}
            autoComplete="email"
            className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none placeholder:text-ink-faint focus:border-blueberry-400"
          />
        </label>
        <button
          type="submit"
          className="wobble-btn border-2 border-ink bg-cream-deep px-4 py-2.5 font-display text-sm font-semibold text-ink transition hover:bg-cream"
        >
          Update email
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
              Enter your current password to change your email to{" "}
              <strong className="text-ink">{newEmail}</strong>.
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
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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
                  disabled={isPending || !password}
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
