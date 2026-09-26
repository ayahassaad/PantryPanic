import type { Metadata } from "next";
import { Patrick_Hand, Nunito } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${patrickHand.variable} ${nunito.variable}`}>
      <body className="antialiased">
        <SiteNav>{children}</SiteNav>
      </body>
    </html>
  );
}
