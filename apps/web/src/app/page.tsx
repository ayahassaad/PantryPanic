import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-basil-600">
        Day 3: accounts
      </p>
      <h1 className="mb-4 text-4xl font-semibold tracking-tight text-basil-700">
        Pantry Panic
      </h1>
      <p className="mb-8 max-w-md text-base text-neutral-600">
        Plan a week of dinners and lunches, get an AI recipe when you don&apos;t
        know what to make, and turn it all into one shopping list.
      </p>

      {user ? (
        <Link
          href="/dashboard"
          className="w-fit rounded-md bg-basil-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-basil-700"
        >
          Go to your dashboard
        </Link>
      ) : (
        <div className="flex items-center gap-4">
          <Link
            href="/signup"
            className="w-fit rounded-md bg-basil-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-basil-700"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-basil-600 underline underline-offset-2"
          >
            Log in
          </Link>
        </div>
      )}
    </main>
  );
}
