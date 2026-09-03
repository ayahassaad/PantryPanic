const DAY_ONE_CHECKLIST = [
  "Monorepo scaffolded (web, mobile, shared packages)",
  "CI running on every commit",
  "This page live on a Vercel preview URL",
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-basil-600">
        Day 1 — foundations
      </p>
      <h1 className="mb-4 text-4xl font-semibold tracking-tight text-basil-700">
        Pantry Panic
      </h1>
      <p className="mb-8 max-w-md text-base text-neutral-600">
        Plan a week of dinners and lunches, get an AI recipe when you don&apos;t
        know what to make, and turn it all into one shopping list.
      </p>
      <ul className="flex flex-col gap-2">
        {DAY_ONE_CHECKLIST.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-neutral-700">
            <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-basil-600" />
            {item}
          </li>
        ))}
      </ul>
    </main>
  );
}
