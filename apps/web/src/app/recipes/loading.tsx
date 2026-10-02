import { Skeleton, SkeletonStatus } from "@/components/skeleton";

// The recipe box: title and two buttons, search box, tabs, then a grid
// of recipe cards (picture, title, a couple of lines). Six cards is
// about one screenful.
//
// A loading.tsx applies to every route nested under its folder that
// doesn't have one of its own — which is why recipes/new, recipes/suggest,
// recipes/[id] and recipes/[id]/edit each carry their own: without them
// they'd all show this card grid on the way in.
export default function RecipesLoading() {
  return (
    <main aria-busy="true" className="mx-auto min-h-screen max-w-5xl px-6 py-8 sm:px-10">
      <SkeletonStatus />
      <div className="mb-7 flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-[70px] w-16 flex-none rounded-full" />
          <Skeleton className="h-10 w-52 rounded-xl" />
        </div>
        <div className="flex flex-none items-center gap-3">
          <Skeleton className="wobble-btn h-11 w-40" />
          <Skeleton className="wobble-btn h-11 w-32" />
        </div>
      </div>

      <Skeleton className="mb-8 h-12 max-w-lg rounded-xl" />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Skeleton className="wobble-btn h-9 w-14" />
        <Skeleton className="wobble-btn h-9 w-28" />
        <Skeleton className="ml-auto h-9 w-40 rounded-xl" />
      </div>

      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="wobble-a border-2 border-ink/15 bg-cream-card p-4">
            <Skeleton className="wobble-b mb-3.5 h-32" />
            <Skeleton className="h-6 w-3/4 rounded-lg" />
            <Skeleton className="mt-2.5 h-4 w-full rounded" />
            <Skeleton className="mt-1.5 h-4 w-2/3 rounded" />
          </li>
        ))}
      </ul>
    </main>
  );
}
