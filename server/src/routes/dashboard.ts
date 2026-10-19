import { Router } from "express";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../auth/middleware.js";
import { XP, levelFromXp, levelTitle, questProgress, weeklySessionTarget, WEEKLY_QUESTS, type WeekStats } from "../gamification/xp.js";
import { linearSlope, movingAverage } from "../lib/nutritionCalc.js";
import { computeXpTotal } from "../gamification/xpTotals.js";
import { vtaperRatio, vtaperLevel, VTAPER_TARGET } from "../lib/vtaper.js";

export const dashboardRouter = Router();

// Day boundaries are computed in the user's timezone (sent by the client as
// Date.getTimezoneOffset()), not the server's — Render runs in UTC, so a 00:30 Dutch
// meal would otherwise land on the previous day.
function addDays(dayKey: string, n: number): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekStartKey(dayKey: string): string {
  const dow = (new Date(`${dayKey}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(dayKey, -dow);
}

const emptyWeek = (): WeekStats => ({ sessions: 0, proteinDays: 0, foodDays: 0, prs: 0 });

dashboardRouter.get("/", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const tz = Math.max(-840, Math.min(840, Number(req.query.tz) || 0));
  const dayKeyOf = (d: Date) => new Date(d.getTime() - tz * 60_000).toISOString().slice(0, 10);

  const todayKey = dayKeyOf(new Date());
  const requested = typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : todayKey;
  const selectedKey = requested;

  const [goal, sessions, foods, metrics, photoCount, latestPhotos, unlockedCount, program, plannedToday, profile, weekSets, plannedWeek, recentPlanned] = await Promise.all([
    prisma.nutritionGoal.findFirst({ where: { userId }, orderBy: { effectiveFrom: "desc" } }),
    prisma.workoutSession.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        programDayId: true,
        programDay: { select: { name: true } },
        setLogs: { where: { isWarmup: false }, select: { weight: true, reps: true, isPR: true } },
      },
    }),
    prisma.foodLogEntry.findMany({
      where: { userId },
      select: {
        date: true,
        quantityGrams: true,
        foodItem: { select: { caloriesPer100g: true, proteinPer100g: true, carbsPer100g: true, fatPer100g: true } },
      },
    }),
    prisma.bodyMetric.findMany({ where: { userId }, orderBy: { date: "asc" }, select: { date: true, weightKg: true, shoulderCm: true, waistCm: true } }),
    prisma.progressPhoto.count({ where: { userId } }),
    prisma.progressPhoto.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 3,
      select: { id: true, date: true, imageData: true },
    }),
    prisma.achievement.count({ where: { userId } }),
    prisma.workoutProgram.findFirst({
      where: { userId },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: { days: { orderBy: { order: "asc" }, include: { _count: { select: { exercises: true } } } } },
    }),
    prisma.plannedWorkout.findMany({
      where: { userId, date: selectedKey },
      orderBy: { createdAt: "asc" },
      include: { programDay: { select: { name: true, program: { select: { name: true } } } } },
    }),
    prisma.userProfile.findUnique({ where: { userId }, select: { heightCm: true, goal: true, birthYear: true, trainDays: true, priorityMuscles: true } }),
    // sets in the last 7 days per muscle group (rolling week, in the user's timezone)
    prisma.setLog.findMany({
      where: { isWarmup: false, workoutSession: { userId, date: { gte: new Date(new Date(`${addDays(todayKey, -6)}T00:00:00Z`).getTime() + tz * 60_000) } } },
      select: { exercise: { select: { muscleGroup: true } } },
    }),
    prisma.plannedWorkout.count({ where: { userId, date: { gte: weekStartKey(todayKey), lte: addDays(weekStartKey(todayKey), 6) } } }),
    prisma.plannedWorkout.findMany({
      where: { userId, date: { gte: addDays(todayKey, -14), lt: todayKey } },
      orderBy: { date: "desc" },
      include: { programDay: { select: { name: true } } },
    }),
  ]);

  // ---- per-day aggregates ----
  const dayTotals = new Map<string, { cal: number; protein: number; carbs: number; fat: number }>();
  for (const f of foods) {
    const k = dayKeyOf(f.date);
    const t = dayTotals.get(k) ?? { cal: 0, protein: 0, carbs: 0, fat: 0 };
    const m = f.quantityGrams / 100;
    t.cal += f.foodItem.caloriesPer100g * m;
    t.protein += f.foodItem.proteinPer100g * m;
    t.carbs += f.foodItem.carbsPer100g * m;
    t.fat += f.foodItem.fatPer100g * m;
    dayTotals.set(k, t);
  }
  const proteinHit = (k: string) => !!goal && (dayTotals.get(k)?.protein ?? 0) >= goal.proteinGrams * 0.95;

  const sessionsByDay = new Map<string, typeof sessions>();
  const weeks = new Map<string, WeekStats>();
  const week = (wk: string) => {
    if (!weeks.has(wk)) weeks.set(wk, emptyWeek());
    return weeks.get(wk)!;
  };
  let totalSets = 0;
  let totalPRs = 0;
  for (const s of sessions) {
    const k = dayKeyOf(s.date);
    sessionsByDay.set(k, [...(sessionsByDay.get(k) ?? []), s]);
    const w = week(weekStartKey(k));
    w.sessions++;
    totalSets += s.setLogs.length;
    const prs = s.setLogs.filter((l) => l.isPR).length;
    w.prs += prs;
    totalPRs += prs;
  }
  let proteinDayCount = 0;
  for (const k of dayTotals.keys()) {
    const w = week(weekStartKey(k));
    w.foodDays++;
    if (proteinHit(k)) {
      w.proteinDays++;
      proteinDayCount++;
    }
  }

  // ---- XP / level / quests ----
  const questsDoneEver = [...weeks.values()].reduce(
    (n, w) => n + WEEKLY_QUESTS.filter((q) => w[q.key] >= q.target).length,
    0
  );
  const xp = await computeXpTotal(userId, tz); // one shared formula with the workout summary
  const lvl = levelFromXp(xp);

  const currentWeekKey = weekStartKey(todayKey);
  const quests = questProgress(weeks.get(currentWeekKey) ?? emptyWeek(), weeklySessionTarget(plannedWeek, profile?.trainDays));

  // weeks in a row with >=1 workout (an empty current week doesn't break it yet)
  const trainedWeeks = new Set([...weeks.entries()].filter(([, w]) => w.sessions > 0).map(([k]) => k));
  let cursor = trainedWeeks.has(currentWeekKey) ? currentWeekKey : addDays(currentWeekKey, -7);
  let streakWeeks = 0;
  while (trainedWeeks.has(cursor)) {
    streakWeeks++;
    cursor = addDays(cursor, -7);
  }
  // days in a row with food logged (today not logged yet doesn't break it)
  let foodCursor = dayTotals.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let foodStreakDays = 0;
  while (dayTotals.has(foodCursor)) {
    foodStreakDays++;
    foodCursor = addDays(foodCursor, -1);
  }

  // ---- week strip + selected day ----
  const stripStart = weekStartKey(selectedKey);
  const strip = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(stripStart, i);
    return {
      date,
      isToday: date === todayKey,
      trained: sessionsByDay.has(date),
      logged: dayTotals.has(date),
      proteinHit: proteinHit(date),
    };
  });

  const selectedTotals = dayTotals.get(selectedKey) ?? { cal: 0, protein: 0, carbs: 0, fat: 0 };
  const selectedSessions = (sessionsByDay.get(selectedKey) ?? []).map((s) => ({
    id: s.id,
    name: s.programDay?.name ?? "Vrije training",
    sets: s.setLogs.length,
    volumeKg: Math.round(s.setLogs.reduce((v, l) => v + l.weight * l.reps, 0)),
    prs: s.setLogs.filter((l) => l.isPR).length,
  }));

  const selectedPlanned = plannedToday.map((p) => ({
    id: p.id,
    title: p.programDay?.name ?? p.title ?? "Training",
    programName: p.programDay?.program.name ?? null,
    startable: !!p.programDayId,
    done:
      p.done ||
      (!!p.sessionId && sessions.some((s) => s.id === p.sessionId)) ||
      (!!p.programDayId && (sessionsByDay.get(selectedKey) ?? []).some((s) => s.programDayId === p.programDayId)),
  }));

  // next program day after the one trained last (cycling), or the first day
  let nextWorkout: { dayId: string; dayName: string; programName: string; exerciseCount: number } | null = null;
  if (program && program.days.length > 0) {
    const dayIds = program.days.map((d) => d.id);
    const last = [...sessions].reverse().find((s) => s.programDayId && dayIds.includes(s.programDayId));
    const next = last ? program.days[(dayIds.indexOf(last.programDayId!) + 1) % program.days.length] : program.days[0];
    nextWorkout = { dayId: next.id, dayName: next.name, programName: program.name, exerciseCount: next._count.exercises };
  }

  // ---- progress cards ----
  const weightSeries = metrics.slice(-14).map((m) => ({ date: dayKeyOf(m.date), value: m.weightKg }));
  let weightDelta: number | null = null;
  if (metrics.length > 1) {
    const latest = metrics[metrics.length - 1];
    const monthAgo = latest.date.getTime() - 30 * 86_400_000;
    const ref = metrics.find((m) => m.date.getTime() >= monthAgo) ?? metrics[0];
    weightDelta = ref === latest ? null : Math.round((latest.weightKg - ref.weightKg) * 10) / 10;
  }

  const calorieSeries = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(todayKey, i - 6);
    return { date, value: Math.round(dayTotals.get(date)?.cal ?? 0) };
  });
  const loggedCal = calorieSeries.filter((d) => d.value > 0);
  const avgCalories = loggedCal.length ? Math.round(loggedCal.reduce((n, d) => n + d.value, 0) / loggedCal.length) : null;

  const sessionsPerWeek = Array.from({ length: 8 }, (_, i) => {
    const date = addDays(currentWeekKey, (i - 7) * 7);
    return { date, value: weeks.get(date)?.sessions ?? 0 };
  });

  const muscleCounts = new Map<string, number>();
  for (const s of weekSets) muscleCounts.set(s.exercise.muscleGroup, (muscleCounts.get(s.exercise.muscleGroup) ?? 0) + 1);
  const muscleVolume = [...muscleCounts.entries()].map(([group, sets]) => ({ group, sets })).sort((a, b) => b.sets - a.sets);

  // planned workouts from the last two weeks that never happened (same "done" rules as the agenda)
  const missed = recentPlanned
    .filter(
      (p) =>
        !p.done &&
        !(p.sessionId && sessions.some((s) => s.id === p.sessionId)) &&
        !(p.programDayId && (sessionsByDay.get(p.date) ?? []).some((s) => s.programDayId === p.programDayId))
    )
    .map((p) => ({ id: p.id, date: p.date, title: p.programDay?.name ?? p.title ?? "Training" }));

  // weight: smoothed line over the last 4 weeks and the weekly rate, compared with the goal
  const lastMonth = metrics.filter((m) => m.date.getTime() >= Date.now() - 28 * 86_400_000);
  const smoothed = movingAverage(lastMonth.map((m) => m.weightKg), 7);
  const slopePerDay =
    lastMonth.length >= 3 ? linearSlope(lastMonth.map((m) => ({ x: m.date.getTime() / 86_400_000, y: m.weightKg }))) : null;
  const ratePerWeek = slopePerDay === null ? null : Math.round(slopePerDay * 7 * 100) / 100;
  const latestKg = metrics.length ? metrics[metrics.length - 1].weightKg : null;
  const ratePct = ratePerWeek !== null && latestKg ? (ratePerWeek / latestKg) * 100 : null;
  let rateStatus: "op-schema" | "te-snel" | "te-langzaam" | null = null;
  if (ratePct !== null && profile?.goal) {
    const [lo, hi] = profile.goal === "bulk" ? [0.2, 0.5] : profile.goal === "cut" ? [-1, -0.4] : [-0.2, 0.2];
    rateStatus = ratePct < lo ? (profile.goal === "cut" ? "te-snel" : "te-langzaam") : ratePct > hi ? (profile.goal === "cut" ? "te-langzaam" : "te-snel") : "op-schema";
  }

  // V-taper: shoulders over waist, from the measurements that have both
  const withBoth = metrics.filter((m) => vtaperRatio(m.shoulderCm, m.waistCm) !== null);
  const vtaperSeries = withBoth.slice(-12).map((m) => ({ date: dayKeyOf(m.date), value: vtaperRatio(m.shoulderCm, m.waistCm)! }));
  const lastBoth = withBoth[withBoth.length - 1];
  const vtaper = lastBoth
    ? {
        ratio: vtaperRatio(lastBoth.shoulderCm, lastBoth.waistCm)!,
        level: vtaperLevel(vtaperRatio(lastBoth.shoulderCm, lastBoth.waistCm)!),
        shoulderCm: lastBoth.shoulderCm,
        waistCm: lastBoth.waistCm,
        target: VTAPER_TARGET,
        delta: vtaperSeries.length > 1 ? Math.round((vtaperSeries[vtaperSeries.length - 1].value - vtaperSeries[0].value) * 100) / 100 : null,
        series: vtaperSeries,
      }
    : null;
  let priorities: string[] = [];
  try {
    const v = JSON.parse(profile?.priorityMuscles ?? "[]");
    if (Array.isArray(v)) priorities = v;
  } catch {
    // ignore malformed priorities
  }

  res.json({
    today: todayKey,
    selected: selectedKey,
    profileMissing: !profile || !profile.heightCm || !profile.goal || !profile.birthYear,
    strip,
    nutrition: {
      goal: goal
        ? { calories: goal.calories, proteinGrams: goal.proteinGrams, carbsGrams: goal.carbsGrams, fatGrams: goal.fatGrams }
        : null,
      totals: {
        calories: Math.round(selectedTotals.cal),
        protein: Math.round(selectedTotals.protein),
        carbs: Math.round(selectedTotals.carbs),
        fat: Math.round(selectedTotals.fat),
      },
    },
    workouts: selectedSessions,
    planned: selectedPlanned,
    nextWorkout,
    progress: {
      weight: {
        latest: latestKg,
        delta: weightDelta,
        series: weightSeries,
        trend: smoothed.map((v, i) => ({ date: dayKeyOf(lastMonth[i].date), value: Math.round(v * 10) / 10 })),
        ratePerWeek,
        ratePct: ratePct === null ? null : Math.round(ratePct * 100) / 100,
        rateStatus,
        goal: profile?.goal ?? null,
      },
      muscleVolume,
      priorities,
      vtaper,
      missed,
      calories: { average: avgCalories, series: calorieSeries },
      sessionsPerWeek,
      photos: { count: photoCount, latest: latestPhotos, lastDate: latestPhotos[0] ? dayKeyOf(latestPhotos[0].date) : null },
    },
    gamification: {
      xp,
      level: lvl.level,
      title: levelTitle(lvl.level),
      levelStartXp: lvl.currentLevelXp,
      nextLevelXp: lvl.nextLevelXp,
      streakWeeks,
      foodStreakDays,
      totalPRs,
      badges: unlockedCount,
      quests,
    },
  });
});
