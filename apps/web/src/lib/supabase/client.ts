import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in the browser (client components, event handlers).
 * Safe to call anywhere on the client — it only ever holds the public
 * anon key, and every query it makes is still checked by Postgres RLS.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
