import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Mascot } from "@/components/mascot";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center sm:items-start sm:text-left">
      <Mascot className="mb-6 h-32 w-28" />
      <h1 className="-rotate-1 mb-4 font-display text-4xl font-bold text-ink sm:text-5xl">
        Pantry Panic
      </h1>
      <p className="mb-8 max-w-md text-lg font-bold text-ink-soft">
        Plan a week of dinners and lunches, get an AI recipe when you
        don&apos;t know what to make, and turn it all into one shopping
        list.
      </p>

      {user ? (
        <Link
          href="/dashboard"
          className="wobble-btn hand-shadow w-fit bg-tomato-400 px-6 py-3 font-display text-base font-semibold text-cream transition hover:brightness-105"
        >
          Go to your dashboard
        </Link>
      ) : (
        <div className="flex items-center gap-5">
          <Link
            href="/signup"
            className="wobble-btn hand-shadow w-fit bg-tomato-400 px-6 py-3 font-display text-base font-semibold text-cream transition hover:brightness-105"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className="border-b-2 border-dashed border-ink text-base font-bold text-ink transition hover:text-tomato-600"
          >
            Log in
          </Link>
        </div>
      )}
    </main>
  );
}
