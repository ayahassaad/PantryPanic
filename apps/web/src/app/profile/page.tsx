import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "./actions";

interface Profile {
  full_name: string | null;
  dietary_preferences: string[];
  allergies: string[];
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error, success } = await searchParams;

  // A profile row is created automatically for every user on signup (see
  // the handle_new_user trigger), so this should always find one — the
  // RLS "select" policy also means this can only ever return this user's
  // own row no matter what.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, dietary_preferences, allergies")
    .eq("id", user.id)
    .single<Profile>();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-16">
      <Link
        href="/dashboard"
        className="mb-8 w-fit text-sm text-neutral-500 underline underline-offset-2"
      >
        &larr; Back to dashboard
      </Link>

      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-basil-600">
        Your profile
      </p>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight text-basil-700">
        Preferences
      </h1>
      <p className="mb-8 max-w-md text-base text-neutral-600">
        {user.email} &mdash; these help tailor recipe suggestions to what
        you can actually eat.
      </p>

      {error && (
        <p className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {success && !error && (
        <p className="mb-6 rounded-md bg-basil-50 px-4 py-3 text-sm text-basil-700">
          Saved.
        </p>
      )}

      {profileError && (
        <p className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Couldn&apos;t load your profile: {profileError.message}
        </p>
      )}

      {profile && (
        <form className="flex flex-col gap-5">
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Name
            <input
              name="fullName"
              type="text"
              defaultValue={profile.full_name ?? ""}
              className="rounded-md border border-neutral-300 px-3 py-2 text-base outline-none focus:border-basil-600"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Dietary preferences
            <input
              name="dietaryPreferences"
              type="text"
              defaultValue={profile.dietary_preferences.join(", ")}
              placeholder="vegetarian, gluten-free, low-carb"
              className="rounded-md border border-neutral-300 px-3 py-2 text-base outline-none focus:border-basil-600"
            />
            <span className="text-xs text-neutral-500">
              Comma-separated.
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Allergies
            <input
              name="allergies"
              type="text"
              defaultValue={profile.allergies.join(", ")}
              placeholder="peanuts, shellfish, dairy"
              className="rounded-md border border-neutral-300 px-3 py-2 text-base outline-none focus:border-basil-600"
            />
            <span className="text-xs text-neutral-500">
              Comma-separated.
            </span>
          </label>

          <button
            formAction={updateProfile}
            className="mt-2 w-fit rounded-md bg-basil-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-basil-700"
          >
            Save
          </button>
        </form>
      )}
    </main>
  );
}
