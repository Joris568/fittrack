import { Router } from "express";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../auth/middleware.js";
import { addDaysKey, dayKeyOf, dayRange, weekStartKey } from "../lib/tz.js";
import { estimate1RM } from "../lib/strength.js";
import { shiftMonth, volumeComparison } from "../lib/recapFun.js";

export const recapRouter = Router();

const MONTH_NAMES = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

/** A "wrapped"-style look back on one calendar month: what was lifted, records, consistency,
 * food and body trend. Defaults to the last full month during the first week of a new month. */
recapRouter.get("/", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const tz = req.tz;
  const todayKey = dayKeyOf(new Date(), tz);
  const currentMonth = todayKey.slice(0, 7);
  const requested = typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : null;
  const month = requested ?? (Number(todayKey.slice(8)) <= 7 ? shiftMonth(currentMonth, -1) : currentMonth);

  const first = `${month}-01`;
  const next = `${shiftMonth(month, 1)}-01`;
  const start = dayRange(first, tz).start;
  const end = dayRange(next, tz).start;
  const [y, m] = month.split("-").map(Number);

  const [sessions, foods, metrics, photoCount] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId, date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
      include: { setLogs: { where: { isWarmup: false }, include: { exercise: { select: { name: true, muscleGroup: true } } } } },
    }),
    prisma.foodLogEntry.findMany({
      where: { userId, date: { gte: start, lt: end } },
      select: { date: true, quantityGrams: true, foodItem: { select: { caloriesPer100g: true, proteinPer100g: true } } },
    }),
    prisma.bodyMetric.findMany({ where: { userId, date: { gte: start, lt: end } }, orderBy: { date: "asc" }, select: { weightKg: true } }),
    prisma.progressPhoto.count({ where: { userId, date: { gte: start, lt: end } } }),
  ]);

  const allSets = sessions.flatMap((s) => s.setLogs);
  const volumeKg = Math.round(allSets.reduce((v, s) => v + s.weight * s.reps, 0));

  const perExercise = new Map<string, number>();
  const perMuscle = new Map<string, number>();
  for (const s of allSets) {
    perExercise.set(s.exercise.name, (perExercise.get(s.exercise.name) ?? 0) + 1);
    perMuscle.set(s.exercise.muscleGroup, (perMuscle.get(s.exercise.muscleGroup) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  const topEx = top(perExercise);
  const topMu = top(perMuscle);

  const prSets = allSets.filter((s) => s.isPR).sort((a, b) => estimate1RM(b.weight, b.reps) - estimate1RM(a.weight, a.reps));

  const perWeek = new Map<string, { sessions: number; volumeKg: number }>();
  for (const s of sessions) {
    const k = weekStartKey(dayKeyOf(s.date, tz));
    const cur = perWeek.get(k) ?? { sessions: 0, volumeKg: 0 };
    cur.sessions++;
    cur.volumeKg += s.setLogs.reduce((v, l) => v + l.weight * l.reps, 0);
    perWeek.set(k, cur);
  }
  const bestWeek = [...perWeek.entries()].sort((a, b) => b[1].volumeKg - a[1].volumeKg)[0];

  const durations = sessions
    .filter((s) => s.finishedAt && s.finishedAt.getTime() - s.date.getTime() < 4 * 3600_000)
    .map((s) => (s.finishedAt!.getTime() - s.date.getTime()) / 60_000);

  const kcalByDay = new Map<string, { kcal: number; protein: number }>();
  for (const f of foods) {
    const k = dayKeyOf(f.date, tz);
    const cur = kcalByDay.get(k) ?? { kcal: 0, protein: 0 };
    cur.kcal += (f.foodItem.caloriesPer100g * f.quantityGrams) / 100;
    cur.protein += (f.foodItem.proteinPer100g * f.quantityGrams) / 100;
    kcalByDay.set(k, cur);
  }
  const loggedDays = [...kcalByDay.values()].filter((d) => d.kcal >= 800);

  res.json({
    month,
    label: `${MONTH_NAMES[m - 1]} ${y}`,
    isCurrent: month === currentMonth,
    hasData: sessions.length > 0 || foods.length > 0 || metrics.length > 0,
    totals: {
      sessions: sessions.length,
      sets: allSets.length,
      volumeKg,
      trainedDays: new Set(sessions.map((s) => dayKeyOf(s.date, tz))).size,
      avgDurationMin: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
    },
    comparison: volumeComparison(volumeKg),
    prs: { count: prSets.length, top: prSets.slice(0, 3).map((s) => ({ exercise: s.exercise.name, weight: s.weight, reps: s.reps })) },
    topExercise: topEx ? { name: topEx[0], sets: topEx[1] } : null,
    topMuscle: topMu ? { group: topMu[0], sets: topMu[1] } : null,
    bestWeek: bestWeek ? { weekStart: bestWeek[0], sessions: bestWeek[1].sessions, volumeKg: Math.round(bestWeek[1].volumeKg) } : null,
    nutrition: loggedDays.length
      ? {
          loggedDays: loggedDays.length,
          avgCalories: Math.round(loggedDays.reduce((a, d) => a + d.kcal, 0) / loggedDays.length),
          avgProtein: Math.round(loggedDays.reduce((a, d) => a + d.protein, 0) / loggedDays.length),
        }
      : null,
    body: metrics.length >= 1
      ? {
          start: metrics[0].weightKg,
          end: metrics[metrics.length - 1].weightKg,
          change: Math.round((metrics[metrics.length - 1].weightKg - metrics[0].weightKg) * 10) / 10,
        }
      : null,
    photos: photoCount,
    prevMonth: shiftMonth(month, -1),
    nextMonth: month === currentMonth ? null : shiftMonth(month, 1),
  });
});

void addDaysKey;
