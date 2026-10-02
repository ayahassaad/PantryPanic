import { FormPageSkeleton } from "@/components/skeleton";

// Shown the instant a link is clicked, while the page it leads to is
// still being built on the server. Every page here checks the session
// and reads from the database before it can render, and without a
// loading screen Next.js holds the *old* page on screen until all of
// that has finished — which is what made a tap on the nav bar feel like
// nothing had happened.
//
// This one is the fallback at the app root: each main page has its own
// loading.tsx with a skeleton shaped like that page (dashboard, planner,
// recipes, shopping list, …), and anything without one lands on this
// generic title-and-fields outline. It renders inside the root layout,
// so the nav bar itself stays put around it.
export default function Loading() {
  return <FormPageSkeleton />;
}
