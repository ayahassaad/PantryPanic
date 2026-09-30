import type { Metadata } from "next";
import { Patrick_Hand, Nunito } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";
import { createClient } from "@/lib/supabase/server";

// Self-hosted via next/font — no separate request to Google Fonts at
// runtime and no font-swap flash, unlike a <link> tag. Each font exposes
// itself as a CSS variable that tailwind.config.ts's fontFamily.sans /
// fontFamily.display point at.
//
// Patrick Hand only ships one weight (400) on Google Fonts — there's no
// bold cut to request. Titles/buttons that also carry font-bold /
// font-semibold classes still work (the browser synthesizes a bold), but
// don't expect it to look as crisp as a real bold weight; if that starts
// looking off anywhere, leaning on size instead of weight for emphasis
// reads better with a handwritten font like this one anyway.
const patrickHand = Patrick_Hand({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-patrick-hand",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "Pantry Panic",
  description:
    "Plan your week of dinners and lunches, get an AI recipe when you're stuck, and get one shopping list for it all.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Runs on every page, logged-in or not — a logged-out visitor (or one
  // on /login, /signup, etc.) just gets isAdmin: false, which is fine
  // since SiteNav already hides its whole nav bar on those routes anyway
  // (see NAV_HIDDEN_PREFIXES). This is the one place that decides
  // whether the "Admin" link even appears; the /admin page itself still
  // does its own real is_admin check server-side, so this is purely
  // about not showing a link a non-admin would just get bounced from.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = profile?.is_admin ?? false;
  }

  return (
    <html lang="en" className={`${patrickHand.variable} ${nunito.variable}`}>
      <body className="antialiased">
        <SiteNav isAdmin={isAdmin}>{children}</SiteNav>
      </body>
    </html>
  );
}
