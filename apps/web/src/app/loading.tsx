import { Mascot } from "@/components/mascot";

// Shown the instant a link is clicked, while the page it leads to is
// still being built on the server. Every page here checks the session
// and reads from the database before it can render, and without a
// loading screen Next.js holds the *old* page on screen until all of
// that has finished — which is what made a tap on the nav bar feel like
// nothing had happened. With this in place the switch (and the nav
// bar's highlight moving to the new tab) is immediate, and the real
// page swaps in as soon as it's ready.
//
// Lives at the app root so it covers every route at once; it renders
// inside the root layout, so the nav bar itself stays put around it.
export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 py-8"
    >
      <Mascot className="mascot-wiggle h-16 w-14" />
      <p className="font-display text-lg font-semibold text-ink-soft">One sec…</p>
    </main>
  );
}
