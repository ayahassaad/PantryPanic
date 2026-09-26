import Link from "next/link";
import { Mascot } from "@/components/mascot";
import { requestPasswordReset } from "./actions";

export default async function ResetPasswordRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
      <div className="wobble-a hand-shadow border-2 border-ink bg-cream-card p-8">
        <Mascot className="mx-auto mb-5 h-16 w-14" />
        <p className="mb-1 text-center font-display text-xs font-semibold uppercase tracking-widest text-tomato-400">
          Forgot something?
        </p>
        <h1 className="mb-7 text-center font-display text-3xl font-bold text-ink">
          Reset your password
        </h1>

        {error && (
          <p className="wobble-btn mb-6 border-2 border-ink bg-tomato-50 px-4 py-3 text-sm font-bold text-tomato-700">
            {error}
          </p>
        )}

        {notice && !error && (
          <p className="wobble-btn mb-6 border-2 border-ink bg-leaf-50 px-4 py-3 text-sm font-bold text-leaf-700">
            {notice}
          </p>
        )}

        <form className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="rounded-xl border-2 border-ink-faint bg-cream-deep px-4 py-2.5 text-base text-ink outline-none focus:border-ink"
            />
          </label>
          <button
            formAction={requestPasswordReset}
            className="wobble-btn hand-shadow mt-2 bg-tomato-400 px-4 py-2.5 font-display text-sm font-semibold text-cream transition hover:brightness-105"
          >
            Send reset link
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm font-bold text-ink-soft">
        <Link
          href="/login"
          className="border-b-2 border-dashed border-tomato-400 text-ink transition hover:text-tomato-600"
        >
          Back to log in
        </Link>
      </p>
    </main>
  );
}
