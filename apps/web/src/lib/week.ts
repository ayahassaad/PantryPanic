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

// ISO 8601 week number — the system Sweden (and most of Europe) uses:
// weeks run Monday-to-Sunday and week 1 is whichever week contains the
// year's first Thursday. That means the week containing Jan 1st isn't
// always "week 1" (if Jan 1st falls on a Fri/Sat/Sun it's still the
// previous year's last week), and a year can end on "week 53". Works off
// any date within the target week — this file always calls it with the
// Monday from startOfWeek(), but the algorithm itself doesn't care which
// day of the week it's handed.
export function getISOWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // Jump to the Thursday of this date's own week (ISO weekday: Mon=1..Sun=7) —
  // that Thursday's calendar year is always the correct ISO week-numbering
  // year, even right around New Year's.
  const isoWeekday = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (4 - isoWeekday));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
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
