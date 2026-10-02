import { Skeleton, SkeletonStatus } from "@/components/skeleton";

// The admin page: a title, a row of summary boxes, then table rows.
export default function AdminLoading() {
  return (
    <main aria-busy="true" className="mx-auto min-h-screen max-w-4xl px-6 py-8 sm:px-10">
      <SkeletonStatus />
      <Skeleton className="mb-7 h-9 w-48 rounded-xl" />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="wobble-btn h-24" />
        ))}
      </div>
      <Skeleton className="mb-3 h-5 w-40 rounded-lg" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-11 rounded-xl" />
        ))}
      </div>
    </main>
  );
}
