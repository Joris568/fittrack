import { prisma } from "../db.js";

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
}

interface Stats {
  totalWorkouts: number;
  totalPRs: number;
  streakWeeks: number;
  totalPrograms: number;
  totalFoodLogDays: number;
}

const CATALOG: (AchievementDef & { check: (s: Stats) => boolean })[] = [
  { key: "first_workout", title: "Eerste training", description: "Je eerste training gelogd", check: (s) => s.totalWorkouts >= 1 },
  { key: "workouts_10", title: "Op dreef", description: "10 trainingen gelogd", check: (s) => s.totalWorkouts >= 10 },
  { key: "workouts_50", title: "Toegewijd", description: "50 trainingen gelogd", check: (s) => s.totalWorkouts >= 50 },
  { key: "workouts_100", title: "Veteraan", description: "100 trainingen gelogd", check: (s) => s.totalWorkouts >= 100 },
  { key: "streak_2", title: "Twee op rij", description: "2 weken op rij getraind", check: (s) => s.streakWeeks >= 2 },
  { key: "streak_4", title: "Consistent", description: "4 weken op rij getraind", check: (s) => s.streakWeeks >= 4 },
  { key: "streak_8", title: "IJzeren discipline", description: "8 weken op rij getraind", check: (s) => s.streakWeeks >= 8 },
  { key: "streak_12", title: "Levensstijl", description: "12 weken op rij getraind", check: (s) => s.streakWeeks >= 12 },
  { key: "first_pr", title: "Eerste record", description: "Je eerste persoonlijke record behaald", check: (s) => s.totalPRs >= 1 },
  { key: "prs_10", title: "Recordjager", description: "10 persoonlijke records behaald", check: (s) => s.totalPRs >= 10 },
  { key: "prs_25", title: "Onstopbaar", description: "25 persoonlijke records behaald", check: (s) => s.totalPRs >= 25 },
  { key: "program_built", title: "Bouwer", description: "Je eerste trainingsprogramma gebouwd", check: (s) => s.totalPrograms >= 1 },
  { key: "first_food_log", title: "Voeding op orde", description: "Je eerste maaltijd gelogd", check: (s) => s.totalFoodLogDays >= 1 },
  { key: "nutrition_week", title: "Voedingsweek", description: "7 dagen voeding gelogd", check: (s) => s.totalFoodLogDays >= 7 },
  { key: "nutrition_month", title: "Op de radar", description: "30 dagen voeding gelogd", check: (s) => s.totalFoodLogDays >= 30 },
];

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d;
}

/** Consecutive weeks (Mon-Sun) with >=1 workout, walking back from the current week. An
 * in-progress current week with no session yet doesn't break the streak. */
export function computeWeeklyStreak(sessionDates: Date[]): number {
  const weekStarts = new Set(sessionDates.map((d) => startOfWeek(d).getTime()));
  let cursor = startOfWeek(new Date());
  if (!weekStarts.has(cursor.getTime())) {
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 7);
  }
  let streak = 0;
  while (weekStarts.has(cursor.getTime())) {
    streak++;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

async function computeStats(userId: string): Promise<Stats> {
  const [totalWorkouts, totalPRs, totalPrograms, sessions, foodEntries] = await Promise.all([
    prisma.workoutSession.count({ where: { userId } }),
    prisma.setLog.count({ where: { isPR: true, workoutSession: { userId } } }),
    prisma.workoutProgram.count({ where: { userId } }),
    prisma.workoutSession.findMany({ where: { userId }, select: { date: true } }),
    prisma.foodLogEntry.findMany({ where: { userId }, select: { date: true } }),
  ]);

  const distinctFoodDays = new Set(foodEntries.map((f) => f.date.toDateString())).size;

  return {
    totalWorkouts,
    totalPRs,
    totalPrograms,
    streakWeeks: computeWeeklyStreak(sessions.map((s) => s.date)),
    totalFoodLogDays: distinctFoodDays,
  };
}

export async function getGamificationSummary(userId: string) {
  const stats = await computeStats(userId);
  const unlocked = await prisma.achievement.findMany({ where: { userId } });
  const unlockedByKey = new Map(unlocked.map((a) => [a.key, a.unlockedAt]));

  const achievements = CATALOG.map((a) => ({
    key: a.key,
    title: a.title,
    description: a.description,
    unlocked: unlockedByKey.has(a.key),
    unlockedAt: unlockedByKey.get(a.key) ?? null,
  }));

  return {
    streakWeeks: stats.streakWeeks,
    totalWorkouts: stats.totalWorkouts,
    totalPRs: stats.totalPRs,
    achievements,
  };
}

/** Computes current stats, unlocks any newly-qualifying achievements, and returns them
 * (for a client-side celebration) — call this after any action that could unlock one. */
export async function checkAndUnlockAchievements(userId: string): Promise<AchievementDef[]> {
  const stats = await computeStats(userId);
  const existing = await prisma.achievement.findMany({ where: { userId }, select: { key: true } });
  const existingKeys = new Set(existing.map((a) => a.key));
  const newlyUnlocked: AchievementDef[] = [];

  for (const def of CATALOG) {
    if (!existingKeys.has(def.key) && def.check(stats)) {
      await prisma.achievement.create({ data: { userId, key: def.key } });
      newlyUnlocked.push({ key: def.key, title: def.title, description: def.description });
    }
  }
  return newlyUnlocked;
}
