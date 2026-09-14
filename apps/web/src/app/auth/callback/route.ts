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
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "That confirmation link didn't work — try logging in, or sign up again.",
    )}`,
  );
}
