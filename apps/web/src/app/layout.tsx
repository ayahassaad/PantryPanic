import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
