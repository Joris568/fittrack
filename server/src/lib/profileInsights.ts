import { prisma } from "../db.js";
import { addDaysKey, dayKeyOf } from "./tz.js";
import {
  ACTIVITY_FACTORS,
  estimateMeasuredTdee,
  formulaTdee,
  suggestGoal,
  type Activity,
  type Goal,
  type Sex,
} from "./nutritionCalc.js";

export function parseNotes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Everything derived from the profile + logged data: calculated and measured maintenance
 * calories and a suggested goal. Pure reads, no side effects. */
export async function computeInsights(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
  const tz = user?.tzOffsetMin ?? 0;
  const profile = user?.profile ?? null;
  const todayKey = dayKeyOf(new Date(), tz);
  const windowStartKey = addDaysKey(todayKey, -27);
  const since = new Date(new Date(`${windowStartKey}T00:00:00Z`).getTime() + tz * 60_000);

  const [latestMetric, metrics, foods] = await Promise.all([
    prisma.bodyMetric.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
    prisma.bodyMetric.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "asc" } }),
    prisma.foodLogEntry.findMany({
      where: { userId, date: { gte: since } },
      select: { date: true, quantityGrams: true, foodItem: { select: { caloriesPer100g: true } } },
    }),
  ]);

  const latestWeightKg = latestMetric?.weightKg ?? null;
  const age = profile?.birthYear ? new Date().getFullYear() - profile.birthYear : null;

  const formula =
    profile?.sex && profile.heightCm && age && profile.activity && latestWeightKg && profile.activity in ACTIVITY_FACTORS
      ? formulaTdee(profile.sex as Sex, latestWeightKg, profile.heightCm, age, profile.activity as Activity)
      : null;

  // Calories per logged day; days under 800 kcal are almost certainly half-logged and would drag the estimate down.
  const kcalByDay = new Map<string, number>();
  for (const f of foods) {
    const k = dayKeyOf(f.date, tz);
    kcalByDay.set(k, (kcalByDay.get(k) ?? 0) + (f.foodItem.caloriesPer100g * f.quantityGrams) / 100);
  }
  const dayKcal = [...kcalByDay.values()].filter((v) => v >= 800);
  const dayIndex = (d: Date) => Math.round((new Date(`${dayKeyOf(d, tz)}T00:00:00Z`).getTime() - new Date(`${windowStartKey}T00:00:00Z`).getTime()) / 86_400_000);
  const measured = estimateMeasuredTdee(dayKcal, metrics.map((m) => ({ day: dayIndex(m.date), kg: m.weightKg })));

  const baseTdee = measured?.tdee ?? formula;
  const goal = (profile?.goal as Goal | null) ?? null;
  const suggestion = baseTdee && latestWeightKg && goal ? { ...suggestGoal(baseTdee, goal, latestWeightKg), basedOn: measured ? "gemeten" : "formule", goal } : null;

  return { profile, notes: parseNotes(profile?.coachNotes), latestWeightKg, age, formula, measured, suggestion };
}

/** Compact Dutch text block for the coach's context. */
export async function buildProfileContext(userId: string): Promise<string> {
  const i = await computeInsights(userId);
  const p = i.profile;
  const lines: string[] = ["## Profiel van de gebruiker"];
  if (!p || (!p.heightCm && !p.goal && !p.birthYear)) {
    lines.push("Profiel nog NIET ingevuld. Vraag er op een natuurlijk moment naar (lengte, leeftijd, geslacht, doel, trainingsdagen per week, blessures) en sla het op met update_profile.");
  } else {
    const bits = [
      p.heightCm ? `${p.heightCm} cm` : null,
      i.age ? `${i.age} jaar` : null,
      p.sex ? (p.sex === "male" ? "man" : "vrouw") : null,
      i.latestWeightKg ? `${i.latestWeightKg} kg` : null,
      p.experience ? `ervaring: ${p.experience}` : null,
      p.goal ? `doel: ${p.goal}` : null,
      p.trainDays ? `traint ${p.trainDays}x per week` : null,
    ].filter(Boolean);
    lines.push(bits.join(", ") + ".");
    if (p.injuries) lines.push(`Blessures/beperkingen: ${p.injuries}`);
  }
  if (i.formula) lines.push(`Onderhoud berekend (formule): ~${i.formula} kcal/dag.`);
  if (i.measured)
    lines.push(
      `Onderhoud GEMETEN (laatste 4 weken, ${i.measured.loggedDays} gelogde dagen, ${i.measured.weighIns} wegingen): ~${i.measured.tdee} kcal/dag; gewichtsverandering ${i.measured.kgPerWeek >= 0 ? "+" : ""}${i.measured.kgPerWeek} kg/week. Gebruik dit getal boven de formule.`
    );
  if (i.suggestion)
    lines.push(
      `Voorgesteld voedingsdoel (${i.suggestion.goal}, op basis van ${i.suggestion.basedOn}): ${i.suggestion.calories} kcal, ${i.suggestion.proteinGrams} g eiwit, ${i.suggestion.carbsGrams} g koolhydraten, ${i.suggestion.fatGrams} g vet.`
    );
  if (i.notes.length) {
    lines.push("Dingen die je over de gebruiker moet onthouden:");
    for (const n of i.notes) lines.push(`- ${n}`);
  }
  return lines.join("\n");
}
