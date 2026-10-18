/** Calendar-day helpers on "YYYY-MM-DD" keys (timezone-free string math). */

export function addDays(dayKey: string, n: number): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Today's date in the user's own timezone as a day key. */
export function todayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

/** Monday of the week containing the given day. */
export function weekStart(dayKey: string): string {
  const dow = (new Date(`${dayKey}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(dayKey, -dow);
}

export function formatDayLong(dayKey: string): string {
  return new Date(`${dayKey}T00:00:00Z`).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function formatMonth(dayKey: string): string {
  return new Date(`${dayKey}T00:00:00Z`).toLocaleDateString("nl-NL", { month: "long", year: "numeric", timeZone: "UTC" });
}
