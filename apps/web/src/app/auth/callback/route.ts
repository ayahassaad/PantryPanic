import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Where Supabase sends people after they click the "confirm your email"
 * link. Exchanges the one-time PKCE code in the URL for a real session,
 * then sends them into the app.
 *
 * This only works if the redirect URL is on Supabase's allowlist
 * (Authentication -> URL Configuration -> Redirect URLs) — otherwise
 * Supabase silently drops the code and this route gets nothing.
 *
 * The only thing that ever lands here is a brand-new signup confirming
 * their email for the first time (nothing else in the app sends someone
 * through this route), so the default destination is the onboarding quiz
 * rather than the dashboard — a returning user's normal /login never
 * passes through here at all, so this never re-shows the quiz to anyone.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "That confirmation link didn't work. Try logging in, or sign up again.",
    )}`,
  );
}
