import Link from "next/link";
import { Mascot } from "@/components/mascot";
import { signup } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
      <div className="wobble-a hand-shadow border-2 border-ink bg-cream-card p-8">
        <Mascot className="mx-auto mb-5 h-16 w-14" />
        <p className="mb-1 text-center font-display text-xs font-semibold uppercase tracking-widest text-tomato-400">
          Let&apos;s get cooking
        </p>
        <h1 className="mb-7 text-center font-display text-3xl font-bold text-ink">
          Create your account
        </h1>

        {error && (
          <p className="wobble-btn mb-6 border-2 border-ink bg-tomato-50 px-4 py-3 text-sm font-bold text-tomato-700">
            {error}
          </p>
        )}

        <form className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
            Name
            <input
              name="fullName"
              type="text"
              autoComplete="name"
              required
              className="rounded-xl border-2 border-ink-faint bg-cream-deep px-4 py-2.5 text-base text-ink outline-none focus:border-ink"
            />
          </label>
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
          <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
            Password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              className="rounded-xl border-2 border-ink-faint bg-cream-deep px-4 py-2.5 text-base text-ink outline-none focus:border-ink"
            />
            <span className="text-xs font-normal text-ink-faint">At least 6 characters.</span>
          </label>
          <button
            formAction={signup}
            className="wobble-btn hand-shadow mt-2 bg-tomato-400 px-4 py-2.5 font-display text-sm font-semibold text-cream transition hover:brightness-105"
          >
            Sign up
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm font-bold text-ink-soft">
        Already have an account?{" "}
        <Link
          href="/login"
          className="border-b-2 border-dashed border-tomato-400 text-ink transition hover:text-tomato-600"
        >
          Log in
        </Link>
      </p>
    </main>
  );
}
