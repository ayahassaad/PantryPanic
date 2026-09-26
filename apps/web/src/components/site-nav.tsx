"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Mascot } from "@/components/mascot";
import { logout } from "@/app/dashboard/actions";

interface IconProps {
  className?: string;
}

// Same line-art style (stroke="currentColor" so it picks up whatever
// text color the link/tab is given, unlike the dashboard's action cards
// which hardcode a fixed stroke color for their colored backgrounds).
// The planner, recipes, and profile icons are the exact same paths as
// the dashboard's action-card icons, just re-colored, so the same shape
// means the same destination everywhere in the app.
function HomeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 34 34" className={className} fill="none">
      <path d="M5,16 L17,5 L29,16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8,14 L8,29 L26,29 L26,14" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M14,29 L14,20 L20,20 L20,29" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

function PlannerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 34 34" className={className} fill="none">
      <rect x="4" y="6" width="26" height="24" rx="3" stroke="currentColor" strokeWidth="2.5" />
      <path d="M4,13 L30,13" stroke="currentColor" strokeWidth="2.5" />
      <path d="M10,3 L10,8 M24,3 L24,8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function RecipesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 34 34" className={className} fill="none">
      <path
        d="M6,30 L6,10 C6,7 8,5 11,5 L23,5 C26,5 28,7 28,10 L28,30"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M6,14 L28,14" stroke="currentColor" strokeWidth="2.5" />
      <path d="M12,5 L12,2 M22,5 L22,2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function ShoppingIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 34 34" className={className} fill="none">
      <path d="M8,11 L26,11 L24,29 L10,29 Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M12,11 C12,6 14,4 17,4 C20,4 22,6 22,11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function ProfileIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 34 34" className={className} fill="none">
      <circle cx="17" cy="11" r="6" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M5,30 C5,21 10,17 17,17 C24,17 29,21 29,30"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const NAV_ITEMS: Array<{ href: string; label: string; Icon: (props: IconProps) => JSX.Element }> = [
  { href: "/dashboard", label: "Home", Icon: HomeIcon },
  { href: "/planner", label: "Planner", Icon: PlannerIcon },
  { href: "/recipes", label: "Recipes", Icon: RecipesIcon },
  { href: "/shopping-list", label: "Shopping", Icon: ShoppingIcon },
  { href: "/profile", label: "Profile", Icon: ProfileIcon },
];

// Pages that run their own full-screen flow — signing in, signing up,
// the OAuth/email callback route — sit outside the logged-in app
// entirely, so a nav bar linking to pages behind the login wall doesn't
// belong on any of them. ("/" itself never actually renders anything —
// see app/page.tsx, it's a pure server-side redirect — so it never
// reaches this component either way.)
const NAV_HIDDEN_PREFIXES = ["/login", "/signup", "/auth", "/onboarding"];

// Dashboard is only "active" on an exact match (it's also the prefix of
// nothing else); every other item is active for itself and anything
// nested under it (e.g. /recipes/abc123 or /recipes/new still highlight
// "Recipes").
function isActive(pathname: string, href: string): boolean {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}

// Wraps every page in a persistent top bar (desktop) / bottom tab bar
// (mobile) so getting from, say, the planner to the shopping list is one
// tap from anywhere, instead of always routing back through /dashboard
// first. One component handling both breakpoints (rather than two
// separately-triggered ones) keeps the "which pages count as the app"
// list (NAV_HIDDEN_PREFIXES) and the active-link logic in exactly one
// place.
export function SiteNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideNav = NAV_HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (hideNav) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* sticky: stays pinned to the top of the viewport as the page
          scrolls, rather than scrolling away with the content beneath
          it. z-30 keeps it above ordinary page content but below the
          z-40 mobile tab bar / z-50 modals, so neither ever fights it. */}
      <header className="sticky top-0 z-30 hidden border-b-2 border-ink bg-cream-card sm:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-10 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Mascot className="h-9 w-8" />
            <span className="font-display text-lg font-bold text-ink">Pantry Panic</span>
          </Link>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map(({ href, label, Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-sm font-bold transition ${
                      active
                        ? "border-ink bg-tomato-400 text-cream"
                        : "border-transparent text-ink-soft hover:border-ink-faint hover:text-ink"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
            {/* Used to live as its own button at the top of the
                dashboard — moved here so it's reachable from every page,
                not just that one. Profile still has its own Log out too
                (a mobile visitor's route to it, since this bar is
                desktop-only), so this isn't the only way to sign out. */}
            <form>
              <button
                formAction={logout}
                className="border-b-2 border-dashed border-ink-soft text-sm font-bold text-ink-soft transition hover:text-ink"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Bottom padding on mobile only — clears the fixed tab bar below
          so it never covers the last bit of a page's content. */}
      <div className="flex-1 pb-16 sm:pb-0">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-cream-card sm:hidden">
        <div className="mx-auto flex max-w-5xl items-stretch justify-between px-1">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-bold transition ${
                  active ? "text-tomato-600" : "text-ink-faint"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
