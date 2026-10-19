/** Minutes since local midnight for a "HH:MM" string, or null if it isn't one. */
export function parseTimeOfDay(value: string): number | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h < 24 && min >= 0 && min < 60 ? h * 60 + min : null;
}

/** Local minutes-of-day for an instant, given the browser-style timezone offset (minutes west of UTC). */
export function localMinutes(now: Date, tz: number): number {
  const local = new Date(now.getTime() - tz * 60_000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

/** A reminder is due once its time has passed, but only for a while after (so a server that was
 * asleep still sends it shortly after waking, yet never hours late), and only once per day. */
export function isDue(nowMinutes: number, configured: string, alreadySent: boolean, graceMin = 90): boolean {
  const at = parseTimeOfDay(configured);
  if (at === null || alreadySent) return false;
  return nowMinutes >= at && nowMinutes < at + graceMin;
}
