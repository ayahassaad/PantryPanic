"use client";

import { useEffect, useState } from "react";

const ROTATE_MS = 10_000;

interface RotatingTipProps {
  tips: string[];
  startIndex: number;
}

// Advances through `tips` on a plain client-side timer. The page itself
// is a Server Component, so it can pick which tip to start on (see
// tipStartIndex in page.tsx), but actually rotating while the page stays
// open needs a client-side interval — hence this being split out as its
// own small client component rather than living inline in page.tsx.
// First render matches the server exactly (both show tips[startIndex]),
// so there's nothing for hydration to mismatch on; the interval only
// starts after mount.
export function RotatingTip({ tips, startIndex }: RotatingTipProps) {
  const [index, setIndex] = useState(startIndex % tips.length);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((current) => (current + 1) % tips.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [tips.length]);

  return <p className="text-sm font-bold text-ink">{tips[index]}</p>;
}
