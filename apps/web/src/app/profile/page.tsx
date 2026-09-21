import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../dashboard/actions";
import { changeEmail, changePassword, updateProfile } from "./actions";
import { DeleteAccountButton } from "./delete-account-button";

interface Profile {
  full_name: string | null;
  dietary_preferences: string[];
  allergies: string[];
  avatar_url: string | null;
  household_size: number;
  unit_system: "metric" | "imperial";
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
    .select("full_name, dietary_preferences, allergies, avatar_url, household_size, unit_system")
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
          {success}
        </p>
      )}

      {profileError && (
        <p className="wobble-btn mb-6 border-2 border-ink bg-tomato-50 px-4 py-3 text-sm font-bold text-tomato-700">
          Couldn&apos;t load your profile: {profileError.message}
        </p>
      )}

      {profile && (
        <form className="flex flex-col gap-5" encType="multipart/form-data">
          <div className="flex items-center gap-4">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- a
              // handful of user-uploaded avatars doesn't need next/image's
              // optimization pipeline (which also needs a configured
              // remote pattern for the Supabase Storage host).
              <img
                src={profile.avatar_url}
                alt=""
                className="h-16 w-16 flex-none rounded-full border-2 border-ink object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full border-2 border-ink bg-citrus-50 font-display text-xl font-bold text-ink-soft">
                {(profile.full_name?.trim()?.[0] ?? user.email?.[0] ?? "?").toUpperCase()}
              </div>
            )}
            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
              Photo
              <input
                name="avatar"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="text-xs font-normal text-ink-faint file:mr-3 file:rounded-lg file:border-2 file:border-ink file:bg-cream-deep file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-ink"
              />
            </label>
          </div>

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
              Comma-separated. Used when AI suggests a recipe for you.
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
              Comma-separated. AI suggestions will avoid these entirely.
            </span>
          </label>

          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1.5 text-sm font-bold text-ink-soft">
              Household size
              <input
                name="householdSize"
                type="number"
                required
                min={1}
                max={20}
                step={1}
                defaultValue={profile.household_size}
                className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none focus:border-citrus-600"
              />
              <span className="text-xs font-normal text-ink-faint">
                Default servings when you set a meal in the planner.
              </span>
            </label>

            <label className="flex flex-1 flex-col gap-1.5 text-sm font-bold text-ink-soft">
              Units
              <select
                name="unitSystem"
                defaultValue={profile.unit_system}
                className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none focus:border-citrus-600"
              >
                <option value="imperial">Imperial (cups, oz, lb)</option>
                <option value="metric">Metric (ml, g, kg)</option>
              </select>
              <span className="text-xs font-normal text-ink-faint">
                Used for AI recipes and shopping list totals.
              </span>
            </label>
          </div>

          <button
            formAction={updateProfile}
            className="wobble-btn hand-shadow mt-2 w-fit bg-citrus-400 px-5 py-2.5 font-display text-sm font-semibold text-ink transition hover:brightness-105"
          >
            Save
          </button>
        </form>
      )}

      <div className="mt-10 border-t-2 border-dashed border-ink-faint pt-8">
        <h2 className="mb-5 font-display text-xl font-bold text-ink">
          Email, password &amp; sign-in
        </h2>

        <div className="flex flex-col gap-6">
          <form className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
            <label className="flex flex-1 flex-col gap-1.5 text-sm font-bold text-ink-soft">
              Change email
              <input
                name="newEmail"
                type="email"
                placeholder={user.email}
                autoComplete="email"
                className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none placeholder:text-ink-faint focus:border-blueberry-400"
              />
            </label>
            <button
              formAction={changeEmail}
              className="wobble-btn border-2 border-ink bg-cream-deep px-4 py-2.5 font-display text-sm font-semibold text-ink transition hover:bg-cream"
            >
              Update email
            </button>
          </form>

          <form className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
              Current password
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none focus:border-blueberry-400"
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
              <label className="flex flex-1 flex-col gap-1.5 text-sm font-bold text-ink-soft">
                New password
                <input
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none focus:border-blueberry-400"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1.5 text-sm font-bold text-ink-soft">
                Confirm password
                <input
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none focus:border-blueberry-400"
                />
              </label>
              <button
                formAction={changePassword}
                className="wobble-btn border-2 border-ink bg-cream-deep px-4 py-2.5 font-display text-sm font-semibold text-ink transition hover:bg-cream"
              >
                Update password
              </button>
            </div>
          </form>

          <form>
            <button
              formAction={logout}
              className="wobble-btn border-2 border-ink bg-cream-card px-4 py-2.5 font-display text-sm font-semibold text-ink transition hover:bg-cream-deep"
            >
              Log out
            </button>
          </form>
        </div>
      </div>

      <div className="mt-10 border-t-2 border-dashed border-ink-faint pt-8">
        <h2 className="mb-3 font-display text-xl font-bold text-ink">Delete account</h2>
        <p className="mb-4 max-w-md text-sm text-ink-soft">
          Permanently deletes your profile, recipes, meal plans, shopping lists, and
          favorites. There&apos;s no undo.
        </p>
        <DeleteAccountButton />
      </div>
    </main>
  );
}
