import { Skeleton, SkeletonStatus } from "@/components/skeleton";

// One recipe: the picture, title, buttons, tags, then the ingredient
// list and the numbered steps.
export default function RecipeLoading() {
  return (
    <main aria-busy="true" className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-8 sm:px-10">
      <SkeletonStatus />
      <Skeleton className="wobble-a mb-6 h-40" />
      <Skeleton className="h-9 w-2/3 rounded-xl" />
      <div className="mb-4 mt-4 flex items-center gap-4">
        <Skeleton className="wobble-btn h-9 w-40" />
        <Skeleton className="h-4 w-10 rounded" />
      </div>
      <Skeleton className="mb-2 h-4 w-full rounded" />
      <Skeleton className="mb-4 h-4 w-3/5 rounded" />
      <div className="mb-8 flex gap-1.5">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>

      <Skeleton className="mb-4 h-3 w-24 rounded" />
      <div className="mb-8 flex flex-col gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <Skeleton className="h-4 w-4 flex-none rounded-full" />
            <Skeleton className={`h-4 rounded ${i % 2 === 0 ? "w-1/2" : "w-2/5"}`} />
          </div>
        ))}
      </div>

      <Skeleton className="mb-4 h-3 w-16 rounded" />
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-6 w-6 flex-none rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="mt-1.5 h-4 w-3/4 rounded" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
