import { prisma } from "../db.js";
import { addDaysKey, dayKeyOf, weekStartKey } from "../lib/tz.js";
import { WEEKLY_QUESTS, XP, type WeekStats } from "./xp.js";

/** Total XP, derived from everything the user has logged (see xp.ts for the weights).
 * Warm-up sets don't count. The dashboard and the workout summary both use this, so a level
 * shown in one place always matches the other. */
export async function computeXpTotal(userId: string, tz: number): Promise<number> {
  const [goal, sessions, foods, metricCount, photoCount, unlockedCount] = await Promise.all([
    prisma.nutritionGoal.findFirst({ where: { userId }, orderBy: { effectiveFrom: "desc" }, select: { proteinGrams: true } }),
    prisma.workoutSession.findMany({
      where: { userId },
      select: { date: true, setLogs: { where: { isWarmup: false }, select: { isPR: true } } },
    }),
    prisma.foodLogEntry.findMany({
      where: { userId },
      select: { date: true, quantityGrams: true, foodItem: { select: { proteinPer100g: true } } },
    }),
    prisma.bodyMetric.count({ where: { userId } }),
    prisma.progressPhoto.count({ where: { userId } }),
    prisma.achievement.count({ where: { userId } }),
  ]);

  const weeks = new Map<string, WeekStats>();
  const week = (k: string) => {
    if (!weeks.has(k)) weeks.set(k, { sessions: 0, proteinDays: 0, foodDays: 0, prs: 0 });
    return weeks.get(k)!;
  };

  let sets = 0;
  let prs = 0;
  for (const s of sessions) {
    const w = week(weekStartKey(dayKeyOf(s.date, tz)));
    w.sessions++;
    sets += s.setLogs.length;
    const p = s.setLogs.filter((l) => l.isPR).length;
    w.prs += p;
    prs += p;
  }

  const proteinByDay = new Map<string, number>();
  for (const f of foods) {
    const k = dayKeyOf(f.date, tz);
    proteinByDay.set(k, (proteinByDay.get(k) ?? 0) + (f.foodItem.proteinPer100g * f.quantityGrams) / 100);
  }
  let proteinDays = 0;
  for (const [k, protein] of proteinByDay) {
    const w = week(weekStartKey(k));
    w.foodDays++;
    if (goal && protein >= goal.proteinGrams * 0.95) {
      w.proteinDays++;
      proteinDays++;
    }
  }

  const questsDone = [...weeks.values()].reduce((n, w) => n + WEEKLY_QUESTS.filter((q) => w[q.key] >= q.target).length, 0);

  return (
    sessions.length * XP.workout +
    sets * XP.set +
    prs * XP.pr +
    proteinByDay.size * XP.foodDay +
    proteinDays * XP.proteinDay +
    metricCount * XP.bodyMetric +
    photoCount * XP.photo +
    unlockedCount * XP.achievement +
    questsDone * XP.quest
  );
}

export { addDaysKey };
