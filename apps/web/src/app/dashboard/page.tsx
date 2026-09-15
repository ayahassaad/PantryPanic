import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-basil-600">
        You&apos;re in
      </p>
      <h1 className="mb-4 text-3xl font-semibold tracking-tight text-basil-700">
        Welcome, {user.email}
      </h1>
      <p className="mb-8 max-w-md text-base text-neutral-600">
        This is where your meal plan and shopping list will live. We&apos;re
        building those next.
      </p>
      <div className="flex items-center gap-4">
        <Link
          href="/recipes"
          className="w-fit rounded-md bg-basil-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-basil-700"
        >
          Browse recipes
        </Link>
        <Link
          href="/profile"
          className="w-fit rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          Edit profile
        </Link>
        <form>
          <button
            formAction={logout}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            Log out
          </button>
        </form>
      </div>
    </main>
  );
}
