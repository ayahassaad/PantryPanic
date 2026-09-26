import type { SupabaseClient } from "@supabase/supabase-js";

// Shared by both AI recipe features — the single-suggestion "Ask AI" form
// (recipes/suggest/actions.ts) and "Fill week with AI"
// (planner/fill-week-actions.ts) draw from the exact same daily counter
// (the ai_recipe_requests table), not one bucket each, since either one
// calls Claude and costs the same real money per call regardless of which
// button was pressed. Centralized here so the two server actions (which
// enforce the limit) and the two pages that show "X left today" (which
// only read it) all agree on the same numbers instead of drifting apart.
export const AI_RATE_LIMIT_MAX_REQUESTS = 10;
export const AI_RATE_LIMIT_WINDOW_HOURS = 24;

// How many of this user's AI calls landed within the current rolling
// window, or null if the count itself couldn't be checked (a transient DB
// hiccup). Callers that enforce the limit should fail OPEN on null — see
// the two server actions — and callers that only display it should treat
// null the same way (show as if nothing's been used yet) rather than
// surface a scary or misleading number over what's ultimately just a cosmetic
// indicator.
export async function countRecentAiRequests(
  supabase: SupabaseClient,
  userId: string,
): Promise<number | null> {
  const since = new Date(
    Date.now() - AI_RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { count, error } = await supabase
    .from("ai_recipe_requests")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .gte("created_at", since);

  if (error) {
    console.error("[ai-rate-limit] couldn't check AI rate limit:", error);
    return null;
  }

  return count ?? 0;
}
