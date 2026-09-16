import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

// Self-hosted via next/font — no separate request to Google Fonts at
// runtime and no font-swap flash, unlike a <link> tag. Each font exposes
// itself as a CSS variable that tailwind.config.ts's fontFamily.sans /
// fontFamily.display point at.
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fredoka",
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
    <html lang="en" className={`${fredoka.variable} ${nunito.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
