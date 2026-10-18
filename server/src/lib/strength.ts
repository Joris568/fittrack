/** Estimated one-rep max (Epley). Reps are capped so a 30-rep burnout can't look like a
 * heavy single — the formula gets unreliable far above ~10 reps. */
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + Math.min(reps, 12) / 30);
}

/** A set is a PR when its estimated 1RM beats everything logged before for that exercise.
 * The very first logged set of an exercise is a baseline, not a record. */
export function isPersonalRecord(previous: { weight: number; reps: number }[], next: { weight: number; reps: number }): boolean {
  if (previous.length === 0) return false;
  const best = Math.max(...previous.map((s) => estimate1RM(s.weight, s.reps)));
  return estimate1RM(next.weight, next.reps) > best + 0.05;
}
