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
  // the handle_new_user trigger), so this should always find one. The
  // RLS "select" policy also means this can only ever return this user's
  // own row no matter what.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, dietary_preferences, allergies")
    .eq("id", user.id)
    .single<Profile>();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-8 sm:px-10">
      <Link
        href="/dashboard"
        className="mb-8 w-fit border-b-2 border-dashed border-ink-soft text-sm font-bold text-ink-soft transition hover:text-ink"
      >
        &larr; Dashboard
      </Link>

      <p className="mb-1 font-display text-xs font-semibold uppercase tracking-widest text-citrus-600">
        Your profile
      </p>
      <h1 className="-rotate-[0.4deg] mb-2 font-display text-3xl font-bold text-ink">
        Preferences
      </h1>
      <p className="mb-7 max-w-md text-base text-ink-soft">
        {user.email}, these help tailor recipe suggestions to what
        you can actually eat.
      </p>

      {error && (
        <p className="wobble-btn mb-6 border-2 border-ink bg-tomato-50 px-4 py-3 text-sm font-bold text-tomato-700">
          {error}
        </p>
      )}

      {success && !error && (
        <p className="wobble-btn mb-6 border-2 border-ink bg-leaf-50 px-4 py-3 text-sm font-bold text-leaf-700">
          Saved.
        </p>
      )}

      {profileError && (
        <p className="wobble-btn mb-6 border-2 border-ink bg-tomato-50 px-4 py-3 text-sm font-bold text-tomato-700">
          Couldn&apos;t load your profile: {profileError.message}
        </p>
      )}

      {profile && (
        <form className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
            Name
            <input
              name="fullName"
              type="text"
              defaultValue={profile.full_name ?? ""}
              className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none focus:border-citrus-600"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
            Dietary preferences
            <input
              name="dietaryPreferences"
              type="text"
              defaultValue={profile.dietary_preferences.join(", ")}
              placeholder="vegetarian, gluten-free, low-carb"
              className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none placeholder:text-ink-faint focus:border-citrus-600"
            />
            <span className="text-xs font-normal text-ink-faint">
              Comma-separated.
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
            Allergies
            <input
              name="allergies"
              type="text"
              defaultValue={profile.allergies.join(", ")}
              placeholder="peanuts, shellfish, dairy"
              className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none placeholder:text-ink-faint focus:border-citrus-600"
            />
            <span className="text-xs font-normal text-ink-faint">
              Comma-separated.
            </span>
          </label>

          <button
            formAction={updateProfile}
            className="wobble-btn hand-shadow mt-2 w-fit bg-citrus-400 px-5 py-2.5 font-display text-sm font-semibold text-ink transition hover:brightness-105"
          >
            Save
          </button>
        </form>
      )}
    </main>
  );
}
