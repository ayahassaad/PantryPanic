"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Mounted once in the root layout, so it stays alive across every
// client-side navigation instead of remounting per page — that's exactly
// why it watches `pathname` with a useEffect rather than just firing once:
// moving from /planner to /recipes via a <Link> doesn't reload the page or
// remount this component, but it should still count as a new page view.
//
// document.referrer is only ever the PREVIOUS page in the browser's own
// history (empty on a same-app client-side nav), which is exactly what we
// want here — it tells us where someone came from the moment they first
// land on the site, not on every click around inside it afterward.
export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/track-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: pathname,
        referrer: document.referrer || null,
      }),
      keepalive: true,
    }).catch(() => {
      // Losing a visit log is never worth surfacing to the visitor.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
