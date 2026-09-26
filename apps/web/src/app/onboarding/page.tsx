import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "./onboarding-wizard";

interface OnboardingProfile {
  cuisine_preferences: string[] | null;
  dietary_preferences: string[] | null;
  allergies: string[] | null;
  household_size: number | null;
  unit_system: "metric" | "imperial" | null;
}

// Reached from auth/callback/route.ts right after a brand-new signup
// confirms their email — see that file for why this, and not /dashboard,
// is the default landing spot for a first-time confirmation. Nothing else
// links here, and every question in it is skippable (site-nav.tsx also
// hides the persistent nav bar on this route, same as /login and /signup,
// so this reads as its own short flow rather than another app page).
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Pre-filling from whatever's already on the profile means re-visiting
  // this route (or a slow double-submit) never wipes out real answers —
  // in practice this is almost always the defaults from the signup
  // trigger, but there's no reason to assume that.
  const { data: profile } = await supabase
    .from("profiles")
    .select("cuisine_preferences, dietary_preferences, allergies, household_size, unit_system")
    .eq("id", user.id)
    .maybeSingle<OnboardingProfile>();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <OnboardingWizard
        initialCuisinePreferences={profile?.cuisine_preferences ?? []}
        initialDietaryPreferences={profile?.dietary_preferences ?? []}
        initialAllergies={profile?.allergies ?? []}
        initialHouseholdSize={profile?.household_size ?? 2}
        initialUnitSystem={profile?.unit_system ?? "imperial"}
      />
    </main>
  );
}
