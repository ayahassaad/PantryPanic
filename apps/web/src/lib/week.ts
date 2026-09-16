// Shared date math for anything organized by "week" — the planner and the
// shopping list both need the exact same Monday-anchored week boundaries,
// so this lives in one place rather than being copied twice and risking
// the two pages disagreeing about which day a week starts on.

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Monday of the week containing `date`, in UTC so the result doesn't
// shift by a day depending on the server's local timezone.
export function startOfWeek(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// Parses a "week" search param into a Monday anchor date, falling back to
// today's week when the param is missing or malformed.
export function resolveWeekStart(weekParam: string | undefined): Date {
  const anchor =
    weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)
      ? new Date(`${weekParam}T00:00:00Z`)
      : new Date();
  return startOfWeek(anchor);
}
