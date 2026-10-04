import { Skeleton, SkeletonStatus } from "@/components/skeleton";

// The fridge itself is drawn for real — door, freezer drawer, handles and
// the pieces of paper stuck to it are all static — and only what comes
// from the database (the greeting, today's meals, the photo, the
// shopping list, the week) is greyed out. Same wrapper classes as
// page.tsx so nothing shifts when the real page takes over.
export default function DashboardLoading() {
  return (
    <main
      aria-busy="true"
      className="flex min-h-[calc(100dvh-4.5rem)] w-full flex-col px-3 py-4 sm:px-6 sm:py-5"
    >
      <SkeletonStatus />
      <div className="hand-shadow flex flex-1 flex-col overflow-hidden rounded-[28px] border-[3px] border-ink sm:rounded-[34px]">
        <div className="fridge-freezer relative flex flex-wrap items-center gap-x-7 gap-y-4 border-b-[3px] border-ink px-5 py-5 md:pl-10 md:pr-24">
          <Skeleton className="h-[92px] w-20 flex-none rounded-[40%] md:h-32 md:w-28" />
          <div className="min-w-0 flex-1 basis-64">
            <Skeleton className="h-9 w-4/5 max-w-xl rounded-xl md:h-12" />
            <Skeleton className="mt-3 h-5 w-3/5 max-w-sm rounded-lg" />
          </div>
          <span
            aria-hidden
            className="fridge-handle absolute right-7 top-1/2 hidden h-[74px] -translate-y-1/2 md:block"
          />
        </div>

        <div className="fridge-door relative flex flex-1 flex-col gap-8 px-5 pb-6 pt-9 md:pb-8 md:pl-10 md:pr-24">
          <span aria-hidden className="fridge-handle absolute right-7 top-9 hidden h-52 md:block" />

          <div className="grid flex-1 items-start gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-[1.25fr_0.85fr_1fr] xl:gap-x-14">
            {/* sticky note */}
            <div className="paper-shadow -rotate-2 border-[2.5px] border-ink bg-citrus-400 px-6 pb-6 pt-7 sm:px-7">
              <Skeleton className="mb-4 h-7 w-28 rounded-lg" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="border-b-2 border-dashed border-ink/25 py-3 last:border-b-0 last:pb-0">
                  <Skeleton className="mb-2 h-3 w-20 rounded" />
                  <Skeleton className={`h-6 rounded-lg ${i === 1 ? "w-1/2" : "w-3/4"}`} />
                </div>
              ))}
            </div>

            {/* pinned photo */}
            <div className="paper-shadow mx-auto w-full max-w-sm rotate-3 border-[2.5px] border-ink bg-cream-card px-4 pb-4 pt-4">
              <Skeleton className="aspect-[4/3] w-full" />
              <Skeleton className="mx-auto mt-3 h-5 w-2/3 rounded-lg" />
              <Skeleton className="mx-auto mt-2 h-3 w-1/3 rounded" />
            </div>

            {/* shopping notepad */}
            <div className="paper-shadow relative rotate-[1.5deg] border-[2.5px] border-ink bg-cream-card px-6 pb-5 pt-8 md:col-span-2 md:max-w-md xl:col-span-1 xl:max-w-none">
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-3.5 border-b-[2.5px] border-ink bg-tomato-400"
              />
              <Skeleton className="mb-3 h-7 w-32 rounded-lg" />
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex h-[38.5px] items-center gap-2.5">
                  <Skeleton className="h-[18px] w-[18px] flex-none rounded-[5px]" />
                  <Skeleton className={`h-4 rounded ${i % 2 === 0 ? "w-2/3" : "w-1/2"}`} />
                </div>
              ))}
            </div>
          </div>

          {/* week magnets */}
          <div className="flex w-full flex-col gap-4 rounded-2xl border-[2.5px] border-ink bg-cream-card px-5 py-3.5 sm:w-fit sm:flex-row sm:items-center">
            <div>
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="mt-2 h-5 w-32 rounded-lg" />
            </div>
            <div className="flex gap-1 sm:gap-2">
              {Array.from({ length: 7 }, (_, i) => (
                <Skeleton key={i} className="h-[70px] flex-1 rounded-xl sm:h-[66px] sm:w-[58px] sm:flex-none" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
