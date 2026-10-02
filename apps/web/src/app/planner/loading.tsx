import { Skeleton, SkeletonStatus } from "@/components/skeleton";

const SLOTS = ["breakfast", "lunch", "dinner"];

// The planner's shape: title block, tip, buttons, then the week grid —
// seven columns by three meal rows of 150px cells on desktop, the day
// chips and three stacked cells on a phone. Same wrappers and breakpoints
// as page.tsx / mobile-week-view.tsx.
export default function PlannerLoading() {
  return (
    <main aria-busy="true" className="mx-auto min-h-screen max-w-[1600px] px-6 py-8 sm:px-10">
      <SkeletonStatus />
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Skeleton className="h-10 w-40 rounded-xl" />
          <Skeleton className="mt-2 h-5 w-32 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-44 rounded" />
        </div>
        <Skeleton className="h-16 max-w-sm flex-1 rounded-2xl" />
        <div className="flex flex-none flex-wrap gap-2.5">
          <Skeleton className="wobble-btn h-10 w-20" />
          <Skeleton className="wobble-btn h-10 w-40" />
          <Skeleton className="wobble-btn h-10 w-32" />
        </div>
      </div>

      <div className="px-14 sm:px-16">
        <div className="hidden overflow-x-auto md:block">
          <div className="grid min-w-[780px] grid-cols-[76px_repeat(7,1fr)] items-center gap-2.5">
            <div />
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="mx-auto h-10 w-10 rounded-lg" />
            ))}
            {SLOTS.flatMap((slot) => [
              <Skeleton key={`${slot}-label`} className="h-4 w-14 rounded" />,
              ...Array.from({ length: 7 }, (_, i) => (
                <Skeleton key={`${slot}-${i}`} className="h-[150px] rounded-xl" />
              )),
            ])}
          </div>
        </div>

        <div className="md:hidden">
          <div className="mb-4 flex gap-1.5 overflow-hidden pb-1">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-[78px] w-12 flex-none rounded-xl" />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {SLOTS.map((slot) => (
              <div key={slot} className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-[150px] rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
