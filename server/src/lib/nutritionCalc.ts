export type Sex = "male" | "female";
export type Goal = "bulk" | "cut" | "maintain";

export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
} as const;
export type Activity = keyof typeof ACTIVITY_FACTORS;

/** Mifflin-St Jeor basal metabolic rate (kcal/day). */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

export function formulaTdee(sex: Sex, weightKg: number, heightCm: number, age: number, activity: Activity): number {
  return Math.round(bmr(sex, weightKg, heightCm, age) * ACTIVITY_FACTORS[activity]);
}

const GOAL_ADJUSTMENT: Record<Goal, number> = { bulk: 300, cut: -400, maintain: 0 };

/** Calories and macros for a goal: lean-bulk surplus / moderate cut, protein 2.0 g/kg
 * (2.2 when cutting), fat 0.9 g/kg, the rest carbs. */
export function suggestGoal(tdee: number, goal: Goal, weightKg: number) {
  const calories = Math.round((tdee + GOAL_ADJUSTMENT[goal]) / 10) * 10;
  const proteinGrams = Math.round(weightKg * (goal === "cut" ? 2.2 : 2.0));
  const fatGrams = Math.round(weightKg * 0.9);
  const carbsGrams = Math.max(0, Math.round((calories - proteinGrams * 4 - fatGrams * 9) / 4));
  return { calories, proteinGrams, carbsGrams, fatGrams };
}

/** Least-squares slope of y over x (undefined with fewer than 2 distinct x values). */
export function linearSlope(points: { x: number; y: number }[]): number | null {
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

export function movingAverage(values: number[], window = 7): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((a, v) => a + v, 0) / slice.length;
  });
}

const KCAL_PER_KG = 7700;

/** Maintenance calories measured from what actually happened: average daily intake minus
 * the energy the weight change represents. Needs enough logged days and weigh-ins spread
 * over at least two weeks, otherwise it returns null instead of a shaky number. */
export function estimateMeasuredTdee(dayKcal: number[], weights: { day: number; kg: number }[]) {
  if (dayKcal.length < 10 || weights.length < 4) return null;
  const span = Math.max(...weights.map((w) => w.day)) - Math.min(...weights.map((w) => w.day));
  if (span < 14) return null;
  const slopePerDay = linearSlope(weights.map((w) => ({ x: w.day, y: w.kg })));
  if (slopePerDay === null) return null;
  const avgIntake = dayKcal.reduce((a, v) => a + v, 0) / dayKcal.length;
  const tdee = Math.round(avgIntake - slopePerDay * KCAL_PER_KG);
  if (tdee < 1200 || tdee > 6000) return null;
  return { tdee, kgPerWeek: Math.round(slopePerDay * 7 * 100) / 100, loggedDays: dayKcal.length, weighIns: weights.length };
}
