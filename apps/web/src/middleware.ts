import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // A fresh random nonce per request lets us run a strict script-src
  // (no 'unsafe-inline') without breaking the App Router's own streaming
  // hydration scripts — Next.js automatically applies this nonce to the
  // inline scripts it injects, as long as it sees it on the request via
  // this exact "x-nonce" header and on the response via the CSP header
  // below. See https://nextjs.org/docs/app/guides/content-security-policy
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Tailwind's output is a static stylesheet, not inline styles, but
    // React itself sets a handful of inline style attributes — allowing
    // those (not arbitrary scripts) is a low-risk, standard tradeoff.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    // No client-side Supabase calls exist yet (everything goes through
    // server actions today), but apps/web/src/lib/supabase/client.ts is
    // already scaffolded for when one does — allow it now so that isn't
    // a silent CSP break later.
    `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");

  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);

  const { supabaseResponse } = await updateSession(request);

  // These headers matter on the RESPONSE, which is what the browser
  // actually enforces — the request-side copy above only exists so
  // Server Components can read the nonce back out via headers().
  supabaseResponse.headers.set("Content-Security-Policy", csp);
  supabaseResponse.headers.set("X-Content-Type-Options", "nosniff");
  // Belt-and-suspenders alongside frame-ancestors above — older browsers
  // that don't understand frame-ancestors still respect this.
  supabaseResponse.headers.set("X-Frame-Options", "DENY");
  supabaseResponse.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin",
  );
  supabaseResponse.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  supabaseResponse.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Run on everything except static assets, so every page/route can
    // rely on a fresh session and every response carries the security
    // headers above.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
