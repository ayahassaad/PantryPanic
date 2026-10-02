import { Skeleton, SkeletonStatus } from "@/components/skeleton";

// The shopping list: heading, week buttons, the "add your own item" box,
// then a few aisles of item rows.
export default function ShoppingListLoading() {
  return (
    <main aria-busy="true" className="mx-auto min-h-screen max-w-2xl px-6 py-8 sm:px-10">
      <SkeletonStatus />
      <div className="mb-6 flex items-center gap-4">
        <Skeleton className="h-[60px] w-[54px] flex-none rounded-full" />
        <div>
          <Skeleton className="mb-2 h-3 w-24 rounded" />
          <Skeleton className="h-8 w-56 rounded-xl" />
        </div>
      </div>
      <div className="mb-6 flex gap-2.5">
        <Skeleton className="wobble-btn h-10 w-28" />
        <Skeleton className="wobble-btn h-10 w-28" />
      </div>
      <Skeleton className="mb-8 h-12 rounded-xl" />

      <div className="flex flex-col gap-7">
        {[4, 3, 3].map((rows, section) => (
          <section key={section}>
            <Skeleton className="mb-3 h-4 w-32 rounded" />
            <div className="flex flex-col gap-2">
              {Array.from({ length: rows }, (_, i) => (
                <Skeleton key={i} className="h-[46px] rounded-xl" />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
