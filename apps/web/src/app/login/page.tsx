import Link from "next/link";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-basil-600">
        Welcome back
      </p>
      <h1 className="mb-8 text-3xl font-semibold tracking-tight text-basil-700">
        Log in
      </h1>

      {error && (
        <p className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-base outline-none focus:border-basil-600"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            className="rounded-md border border-neutral-300 px-3 py-2 text-base outline-none focus:border-basil-600"
          />
        </label>
        <button
          formAction={login}
          className="mt-2 rounded-md bg-basil-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-basil-700"
        >
          Log in
        </button>
      </form>

      <p className="mt-6 text-sm text-neutral-600">
        New here?{" "}
        <Link
          href="/signup"
          className="font-medium text-basil-600 underline underline-offset-2"
        >
          Create an account
        </Link>
      </p>
    </main>
  );
}
