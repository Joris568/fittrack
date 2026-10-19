import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../auth/middleware.js";
import { addDaysKey, dayKeyOf, weekStartKey } from "../lib/tz.js";
import { linearSlope, type Goal } from "../lib/nutritionCalc.js";
import { countHardWeeks, deloadSignal, evaluateWeeklyCheckin } from "../lib/weeklyCheckin.js";
import { detectPlateaus } from "../lib/plateau.js";

export const checkinRouter = Router();

const HIDE_DAYS = 6;

async function buildWeekly(userId: string, tz: number) {
  const [profile, goal] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.nutritionGoal.findFirst({ where: { userId }, orderBy: { effectiveFrom: "desc" } }),
  ]);
  if (!profile?.goal || !goal) return { available: false as const };

  const todayKey = dayKeyOf(new Date(), tz);
  const since = new Date(new Date(`${addDaysKey(todayKey, -13)}T00:00:00Z`).getTime() + tz * 60_000);
  const [metrics, foods] = await Promise.all([
    prisma.bodyMetric.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "asc" } }),
    prisma.foodLogEntry.findMany({ where: { userId, date: { gte: since } }, select: { date: true, quantityGrams: true, foodItem: { select: { caloriesPer100g: true } } } }),
  ]);

  const kcalByDay = new Map<string, number>();
  for (const f of foods) {
    const k = dayKeyOf(f.date, tz);
    kcalByDay.set(k, (kcalByDay.get(k) ?? 0) + (f.foodItem.caloriesPer100g * f.quantityGrams) / 100);
  }
  const loggedDays = [...kcalByDay.values()].filter((v) => v >= 800).length; // half-logged days don't count

  const day = (d: Date) => d.getTime() / 86_400_000;
  const slope = metrics.length >= 2 ? linearSlope(metrics.map((m) => ({ x: day(m.date), y: m.weightKg }))) : null;
  const span = metrics.length >= 2 ? day(metrics[metrics.length - 1].date) - day(metrics[0].date) : 0;
  const weightKg = metrics.length ? metrics[metrics.length - 1].weightKg : 0;

  const result = evaluateWeeklyCheckin({
    goal: profile.goal as Goal,
    weightKg,
    ratePerWeek: slope === null ? null : Math.round(slope * 7 * 100) / 100,
    weighIns: metrics.length,
    weighSpanDays: span,
    loggedDays,
    currentCalories: goal.calories,
  });

  const newGoal =
    result.deltaKcal !== 0
      ? {
          calories: result.newCalories,
          proteinGrams: goal.proteinGrams,
          fatGrams: goal.fatGrams,
          carbsGrams: Math.max(0, Math.round((result.newCalories - goal.proteinGrams * 4 - goal.fatGrams * 9) / 4)),
        }
      : null;

  const handledAt = profile.checkinHandledAt;
  const hidden = !!handledAt && Date.now() - handledAt.getTime() < HIDE_DAYS * 86_400_000;
  return {
    available: true as const,
    hidden,
    result,
    currentGoal: { calories: goal.calories, proteinGrams: goal.proteinGrams, carbsGrams: goal.carbsGrams, fatGrams: goal.fatGrams },
    newGoal,
  };
}

checkinRouter.get("/weekly", async (req: AuthedRequest, res) => {
  res.json(await buildWeekly(req.userId!, req.tz));
});

checkinRouter.post("/weekly/handle", async (req: AuthedRequest, res) => {
  const parsed = z.object({ apply: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "apply (true/false) vereist" });
  const userId = req.userId!;
  const weekly = await buildWeekly(userId, req.tz);
  if (!weekly.available) return res.status(400).json({ error: "Stel eerst je profiel (doel) en voedingsdoel in." });
  if (parsed.data.apply && weekly.newGoal) await prisma.nutritionGoal.create({ data: { userId, ...weekly.newGoal } });
  await prisma.userProfile.update({ where: { userId }, data: { checkinHandledAt: new Date() } });
  res.json({ applied: parsed.data.apply && !!weekly.newGoal, newGoal: parsed.data.apply ? weekly.newGoal : null });
});

/** Fatigue check for the dashboard: should this week be a deload? */
checkinRouter.get("/deload", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const tz = req.tz;
  const todayKey = dayKeyOf(new Date(), tz);
  const currentWeek = weekStartKey(todayKey);
  const since = new Date(new Date(`${addDaysKey(currentWeek, -7 * 11)}T00:00:00Z`).getTime() + tz * 60_000);

  const [sessions, recent, plateaus] = await Promise.all([
    prisma.workoutSession.findMany({ where: { userId, date: { gte: since } }, select: { date: true } }),
    prisma.workoutSession.findMany({ where: { userId, readiness: { not: null } }, orderBy: { date: "desc" }, take: 4, select: { readiness: true } }),
    detectPlateaus(userId),
  ]);

  const perWeek = new Map<string, number>();
  for (const s of sessions) {
    const k = weekStartKey(dayKeyOf(s.date, tz));
    perWeek.set(k, (perWeek.get(k) ?? 0) + 1);
  }
  const weeks = Array.from({ length: 12 }, (_, i) => perWeek.get(addDaysKey(currentWeek, -7 * i)) ?? 0);

  const lowReadiness = recent.filter((r) => {
    try {
      return (JSON.parse(r.readiness!) as { score?: number }).score !== undefined && (JSON.parse(r.readiness!) as { score: number }).score <= 4;
    } catch {
      return false;
    }
  }).length;

  res.json(deloadSignal({ plateauCount: plateaus.length, hardWeeks: countHardWeeks(weeks), lowReadiness }));
});
