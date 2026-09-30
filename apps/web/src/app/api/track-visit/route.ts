import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Fired once per page view by <VisitTracker /> (see
// components/visit-tracker.tsx, mounted in the root layout) — a tiny
// fire-and-forget POST from the browser, not something the visitor ever
// sees a response from. Kept as its own route (rather than a server
// action) so it can be called with a plain fetch + keepalive from a
// useEffect without needing a <form>.
//
// Deliberately never fails loudly: a dropped visit log is not worth
// breaking or slowing down the page over, so every error path below
// still returns 200.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const path =
    typeof body?.path === "string" && body.path.length > 0
      ? body.path.slice(0, 500)
      : "/";
  const referrer =
    typeof body?.referrer === "string" && body.referrer.length > 0
      ? body.referrer.slice(0, 500)
      : null;

  // These headers only exist for requests that actually pass through
  // Vercel's edge network — present in production, absent in local dev
  // (request.geo was removed from Next.js; reading the headers directly
  // is the current recommended replacement). City names come through
  // URI-encoded (e.g. "New%20York").
  const country = request.headers.get("x-vercel-ip-country");
  const rawCity = request.headers.get("x-vercel-ip-city");
  const city = rawCity ? decodeURIComponent(rawCity) : null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("page_visits")
    .insert({ path, referrer, country, city });

  if (error) {
    console.error("track-visit insert failed:", error);
  }

  // TEMPORARY: surfacing the raw error in the response so it can be
  // diagnosed from the browser's network tab (visits weren't showing up
  // in the admin page's totals, and this route was silently swallowing
  // the reason why). Safe to leave logging via console.error long-term,
  // but this response body should go back to just {ok:true} once the
  // real cause is found and fixed.
  return NextResponse.json({ ok: !error, error: error?.message ?? null });
}
