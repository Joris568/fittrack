/** In-memory brute-force guard for the shared-password login: a handful of wrong guesses
 * per IP, then a cool-down. State resets on restart, which is fine at this scale. */
const MAX_FAILURES = 8;
const WINDOW_MS = 15 * 60_000;

const failures = new Map<string, { count: number; resetAt: number }>();

export function loginBlockedForMs(ip: string, now = Date.now()): number {
  const entry = failures.get(ip);
  if (!entry || entry.resetAt <= now) return 0;
  return entry.count >= MAX_FAILURES ? entry.resetAt - now : 0;
}

export function recordLoginFailure(ip: string, now = Date.now()) {
  const entry = failures.get(ip);
  if (!entry || entry.resetAt <= now) failures.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count++;
}

export function clearLoginFailures(ip: string) {
  failures.delete(ip);
}
