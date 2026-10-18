/** Day grouping in the user's timezone. `tz` is the browser's Date.getTimezoneOffset()
 * (minutes, positive west of UTC), because the server runs in UTC but the user thinks in
 * local days — without this, a meal logged at 00:30 Dutch time lands on "yesterday". */

export function parseTz(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(-840, Math.min(840, Math.round(n))) : 0;
}

/** Local calendar day ("YYYY-MM-DD") of an instant. */
export function dayKeyOf(d: Date, tz: number): string {
  return new Date(d.getTime() - tz * 60_000).toISOString().slice(0, 10);
}

export function addDaysKey(dayKey: string, n: number): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** [start, end) instants covering one local day. */
export function dayRange(dayKey: string, tz: number): { start: Date; end: Date } {
  const start = new Date(new Date(`${dayKey}T00:00:00Z`).getTime() + tz * 60_000);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export function weekStartKey(dayKey: string): string {
  const dow = (new Date(`${dayKey}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return addDaysKey(dayKey, -dow);
}

/** Accepts a "YYYY-MM-DD" key or any ISO timestamp and returns the local day key. */
export function toDayKey(value: unknown, tz: number): string | null {
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : dayKeyOf(d, tz);
}
