import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Mascot } from "@/components/mascot";

interface AdminProfileRow {
  id: string;
  full_name: string | null;
  household_size: number;
  is_admin: boolean;
  created_at: string;
}

interface RecipeSourceRow {
  source: "user" | "ai" | "seed";
}

interface PageVisitRow {
  visited_at: string;
  path: string;
  referrer: string | null;
  country: string | null;
  city: string | null;
}

// Shared by both the "Top referrers" list and the per-visit table below
// it, so a given referrer reads the same way in both places.
function formatReferrer(referrer: string | null): string {
  if (!referrer) return "Direct / none";
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return referrer;
  }
}

// One stat tile — same wobble-a/hand-shadow card language every other
// page in the app already uses for a standalone block of content, just
// sized down and centered for a single number instead of a form or list.
function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className={`wobble-a hand-shadow flex flex-col items-center gap-1 border-2 border-ink ${accent} px-6 py-5 text-center`}>
      <span className="font-display text-3xl font-bold text-ink">{value}</span>
      <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">{label}</span>
    </div>
  );
}

// Gated on profiles.is_admin (see the 20260930000000_admin_role
// migration) rather than a hardcoded email check here — that keeps
// "who's an admin" a single source of truth in the database instead of
// also needing a code change (and a redeploy) to add or remove one.
// profiles has no email column of its own (email only lives on
// auth.users, which the app's anon-key client can never query — see
// lib/supabase/server.ts), so this page intentionally doesn't show one;
// full_name and join date are what's actually available to display.
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  // Not an error state — just quietly bounce a non-admin back to the
  // dashboard, the same way a logged-out visitor gets bounced to /login
  // rather than shown a "you're not allowed" page.
  if (!ownProfile?.is_admin) {
    redirect("/dashboard");
  }

  const [
    { count: userCount },
    { count: recipeCount },
    { data: sourceRows },
    { data: profileRows },
    { count: visitCount },
    { data: visitRows },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("recipes").select("*", { count: "exact", head: true }),
    supabase.from("recipes").select("source").returns<RecipeSourceRow[]>(),
    supabase
      .from("profiles")
      .select("id, full_name, household_size, is_admin, created_at")
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<AdminProfileRow[]>(),
    supabase.from("page_visits").select("*", { count: "exact", head: true }),
    // Top locations/referrers are computed below from a recent sample
    // rather than every row ever logged — accurate enough for "where are
    // people coming from lately" without a separate SQL aggregate query.
    supabase
      .from("page_visits")
      .select("visited_at, path, referrer, country, city")
      .order("visited_at", { ascending: false })
      .limit(1000)
      .returns<PageVisitRow[]>(),
  ]);

  const recipesBySource = { user: 0, ai: 0, seed: 0 };
  for (const row of sourceRows ?? []) {
    recipesBySource[row.source] = (recipesBySource[row.source] ?? 0) + 1;
  }

  const locationCounts = new Map<string, number>();
  const referrerCounts = new Map<string, number>();
  for (const visit of visitRows ?? []) {
    const location =
      visit.city && visit.country
        ? `${visit.city}, ${visit.country}`
        : (visit.country ?? "Unknown");
    locationCounts.set(location, (locationCounts.get(location) ?? 0) + 1);

    // Grouped by hostname rather than the full URL, so
    // "google.com/search?q=..." and "google.com/search?q=other" count as
    // one "google.com" source instead of two separate referrers.
    const referrerLabel = formatReferrer(visit.referrer);
    referrerCounts.set(referrerLabel, (referrerCounts.get(referrerLabel) ?? 0) + 1);
  }
  const topLocations = [...locationCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topReferrers = [...referrerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-8 sm:px-10">
      <div className="mb-7 flex items-center gap-4">
        <Mascot className="h-[60px] w-[54px] flex-none" />
        <div>
          <p className="mb-1 font-display text-xs font-semibold uppercase tracking-widest text-tomato-400">
            Admin
          </p>
          <h1 className="-rotate-[0.4deg] font-display text-2xl font-bold text-ink sm:text-3xl">
            App overview
          </h1>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Users" value={userCount ?? 0} accent="bg-blueberry-50" />
        <StatCard label="Recipes" value={recipeCount ?? 0} accent="bg-tomato-50" />
        <StatCard label="AI-suggested" value={recipesBySource.ai} accent="bg-citrus-50" />
        <StatCard label="Starter recipes" value={recipesBySource.seed} accent="bg-leaf-50" />
      </div>

      <h2 className="mb-3 font-display text-lg font-bold text-ink">
        Users ({profileRows?.length ?? 0}{(profileRows?.length ?? 0) >= 200 ? "+" : ""})
      </h2>

      <div className="wobble-a hand-shadow overflow-hidden border-2 border-ink bg-cream-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b-2 border-ink bg-cream-deep text-xs font-bold uppercase tracking-wide text-ink-soft">
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Household</th>
              <th className="px-4 py-2.5">Joined</th>
              <th className="px-4 py-2.5">Role</th>
            </tr>
          </thead>
          <tbody>
            {(profileRows ?? []).map((profile) => (
              <tr key={profile.id} className="border-b border-ink-faint/30 last:border-b-0">
                <td className="px-4 py-2.5 font-semibold text-ink">
                  {profile.full_name || <span className="font-normal text-ink-faint">Unnamed</span>}
                </td>
                <td className="px-4 py-2.5 text-ink-soft">{profile.household_size}</td>
                <td className="px-4 py-2.5 text-ink-soft">
                  {new Date(profile.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-2.5">
                  {profile.is_admin ? (
                    <span className="rounded-full border border-ink bg-tomato-400 px-2 py-0.5 text-[11px] font-bold text-cream">
                      Admin
                    </span>
                  ) : (
                    <span className="text-xs text-ink-faint">Member</span>
                  )}
                </td>
              </tr>
            ))}
            {(profileRows?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-faint">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Our own visit log (see components/visit-tracker.tsx), separate
          from Vercel's own Analytics tab on vercel.com — this is what
          lets the numbers live here instead of only on Vercel's site.
          Countries/cities only fill in for visits on the live deployment
          (Vercel adds those headers; local dev never has them), and
          "you" testing the site counts as a visit too, so treat these as
          a rough picture rather than an exact audience count. */}
      <h2 className="mb-3 mt-10 font-display text-lg font-bold text-ink">Site visits</h2>

      {/* The individual log — newest first. Capped at 150 rows on the
          page itself (the queries above already pull up to 1,000 for the
          totals/top-lists, this just doesn't render all of them at once)
          so the table stays scannable instead of turning into an endless
          scroll. */}
      <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-ink-soft">
        Recent visits
      </h3>
      <div className="mb-6 wobble-a hand-shadow overflow-hidden border-2 border-ink bg-cream-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b-2 border-ink bg-cream-deep text-xs font-bold uppercase tracking-wide text-ink-soft">
              <th className="px-4 py-2.5">Time</th>
              <th className="px-4 py-2.5">Page</th>
              <th className="px-4 py-2.5">Location</th>
              <th className="px-4 py-2.5">Referrer</th>
            </tr>
          </thead>
          <tbody>
            {(visitRows ?? []).slice(0, 150).map((visit, index) => (
              <tr
                // No stable id was selected from page_visits, and a visit
                // row is never edited or reordered client-side, so the
                // array's own index is a safe key here.
                key={index}
                className="border-b border-ink-faint/30 last:border-b-0"
              >
                <td className="px-4 py-2.5 text-ink-soft">
                  {new Date(visit.visited_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-4 py-2.5 font-semibold text-ink">{visit.path}</td>
                <td className="px-4 py-2.5 text-ink-soft">
                  {visit.city && visit.country
                    ? `${visit.city}, ${visit.country}`
                    : (visit.country ?? "Unknown")}
                </td>
                <td className="px-4 py-2.5 text-ink-soft">{formatReferrer(visit.referrer)}</td>
              </tr>
            ))}
            {(visitRows?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-faint">
                  No visits recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total visits" value={visitCount ?? 0} accent="bg-carrot-50" />
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-ink-soft">
            Top locations
          </h3>
          <ul className="wobble-a hand-shadow flex flex-col border-2 border-ink bg-cream-card px-4">
            {topLocations.map(([location, count]) => (
              <li
                key={location}
                className="flex items-center justify-between border-b border-ink-faint/20 py-2 text-sm last:border-b-0"
              >
                <span className="text-ink">{location}</span>
                <span className="font-bold text-ink-soft">{count}</span>
              </li>
            ))}
            {topLocations.length === 0 && (
              <li className="py-4 text-center text-sm text-ink-faint">No visits recorded yet.</li>
            )}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-ink-soft">
            Top referrers
          </h3>
          <ul className="wobble-a hand-shadow flex flex-col border-2 border-ink bg-cream-card px-4">
            {topReferrers.map(([referrer, count]) => (
              <li
                key={referrer}
                className="flex items-center justify-between border-b border-ink-faint/20 py-2 text-sm last:border-b-0"
              >
                <span className="text-ink">{referrer}</span>
                <span className="font-bold text-ink-soft">{count}</span>
              </li>
            ))}
            {topReferrers.length === 0 && (
              <li className="py-4 text-center text-sm text-ink-faint">No visits recorded yet.</li>
            )}
          </ul>
        </div>
      </div>
    </main>
  );
}
