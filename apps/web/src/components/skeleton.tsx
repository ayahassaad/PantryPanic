// Building blocks for the loading skeletons (the loading.tsx next to each
// page). A skeleton is a grey, gently pulsing outline of the page that's
// on its way — same wrapper, same rough blocks in the same places — so a
// click on the nav bar lands on something already shaped like its
// destination, and the real content fills in without the layout jumping.
//
// All plain markup with no state, so these stay Server Components.

// One pulsing grey block. It deliberately sets no size or corner radius
// of its own — every use passes those in (`h-6 w-40 rounded-xl`), since
// two competing rounded-* classes on one element don't resolve in the
// order they're written.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse bg-ink/10 ${className}`} />;
}

// What a screen reader hears in place of all those silent grey blocks.
export function SkeletonStatus() {
  return <span className="sr-only">Loading…</span>;
}

// A title and a column of labelled fields — the shape shared by every
// form page (profile, new recipe, edit recipe, ask AI), and close enough
// for the handful of pages with no skeleton of their own (see
// app/loading.tsx).
export function FormPageSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <main aria-busy="true" className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-8 sm:px-10">
      <SkeletonStatus />
      <div className="mb-7 flex items-center gap-4">
        <Skeleton className="h-[58px] w-[52px] flex-none rounded-full" />
        <Skeleton className="h-9 w-2/3 rounded-xl" />
      </div>
      <div className="flex flex-col gap-5">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className={`w-full rounded-xl ${i === 1 ? "h-28" : "h-12"}`} />
          </div>
        ))}
        <Skeleton className="wobble-btn h-11 w-36" />
      </div>
    </main>
  );
}
