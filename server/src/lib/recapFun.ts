const THINGS: { name: string; plural: string; kg: number }[] = [
  { name: "scooter", plural: "scooters", kg: 100 },
  { name: "koe", plural: "koeien", kg: 700 },
  { name: "auto", plural: "auto's", kg: 1500 },
  { name: "olifant", plural: "olifanten", kg: 5000 },
  { name: "stadsbus", plural: "stadsbussen", kg: 12000 },
  { name: "Boeing 737", plural: "Boeing 737's", kg: 41000 },
  { name: "blauwe vinvis", plural: "blauwe vinvissen", kg: 150000 },
];

/** A friendly comparison for a lifted total: the biggest thing that fits at least twice. */
export function volumeComparison(volumeKg: number): { count: number; thing: string } | null {
  if (volumeKg < 200) return null;
  const fit = THINGS.filter((t) => volumeKg / t.kg >= 2);
  const pick = fit.length ? fit[fit.length - 1] : THINGS.find((t) => volumeKg / t.kg >= 1);
  if (!pick) return null;
  const count = Math.floor(volumeKg / pick.kg);
  return { count, thing: count === 1 ? pick.name : pick.plural };
}

/** "2026-10" for a Date in the user's timezone, and the month before/after a key. */
export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
