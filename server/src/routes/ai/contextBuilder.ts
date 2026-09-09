import { prisma } from "../../db.js";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function buildUserContext(userId: string): Promise<string> {
  const sixWeeksAgo = new Date();
  sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [sessions, goal, foodEntries, bodyMetrics] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId, date: { gte: sixWeeksAgo } },
      orderBy: { date: "asc" },
      include: { setLogs: { include: { exercise: true } }, programDay: true },
    }),
    prisma.nutritionGoal.findFirst({
      where: { userId, effectiveFrom: { lte: new Date() } },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.foodLogEntry.findMany({
      where: { userId, date: { gte: fourteenDaysAgo } },
      include: { foodItem: true },
      orderBy: { date: "asc" },
    }),
    prisma.bodyMetric.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 10,
    }),
  ]);

  const lines: string[] = [];

  // Training summary: per exercise, chronological top-set trend.
  lines.push("## Trainingsgeschiedenis (laatste 6 weken)");
  if (sessions.length === 0) {
    lines.push("Geen trainingen gelogd.");
  } else {
    const byExercise = new Map<string, { date: string; sets: string }[]>();
    for (const session of sessions) {
      const byExInSession = new Map<string, typeof session.setLogs>();
      for (const set of session.setLogs) {
        const arr = byExInSession.get(set.exercise.name) ?? [];
        arr.push(set);
        byExInSession.set(set.exercise.name, arr);
      }
      for (const [exName, sets] of byExInSession) {
        const summary = sets
          .map((s) => `${s.reps}x${s.weight}kg${s.rpe ? `@RPE${s.rpe}` : ""}`)
          .join(", ");
        const arr = byExercise.get(exName) ?? [];
        arr.push({ date: fmtDate(session.date), sets: summary });
        byExercise.set(exName, arr);
      }
    }
    for (const [exName, history] of byExercise) {
      lines.push(`- ${exName}:`);
      for (const h of history.slice(-5)) {
        lines.push(`  - ${h.date}: ${h.sets}`);
      }
    }
    lines.push(`Totaal aantal sessies: ${sessions.length}`);
  }

  // Weekly volume per muscle group (last 7 days) — directly comparable to the 10-20 sets/week guideline.
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentSessions = sessions.filter((s) => s.date >= sevenDaysAgo);
  lines.push("\n## Trainingsvolume per spiergroep (laatste 7 dagen)");
  if (recentSessions.length === 0) {
    lines.push("Geen trainingen in de laatste 7 dagen.");
  } else {
    const setsByMuscleGroup = new Map<string, number>();
    for (const session of recentSessions) {
      for (const set of session.setLogs) {
        setsByMuscleGroup.set(
          set.exercise.muscleGroup,
          (setsByMuscleGroup.get(set.exercise.muscleGroup) ?? 0) + 1
        );
      }
    }
    for (const [muscleGroup, sets] of setsByMuscleGroup) {
      lines.push(`- ${muscleGroup}: ${sets} sets (richtlijn: 10-20 sets/week)`);
    }
  }

  // Nutrition goal
  lines.push("\n## Voedingsdoel");
  if (goal) {
    lines.push(
      `Calorieen: ${goal.calories} kcal, Eiwit: ${goal.proteinGrams}g, Koolhydraten: ${goal.carbsGrams}g, Vet: ${goal.fatGrams}g`
    );
  } else {
    lines.push("Geen voedingsdoel ingesteld.");
  }

  // Nutrition adherence, last 14 days, grouped by day
  lines.push("\n## Voeding (laatste 14 dagen, dagtotalen)");
  if (foodEntries.length === 0) {
    lines.push("Geen voeding gelogd.");
  } else {
    const byDay = new Map<string, { cal: number; protein: number; carbs: number; fat: number }>();
    for (const entry of foodEntries) {
      const key = fmtDate(entry.date);
      const factor = entry.quantityGrams / 100;
      const totals = byDay.get(key) ?? { cal: 0, protein: 0, carbs: 0, fat: 0 };
      totals.cal += entry.foodItem.caloriesPer100g * factor;
      totals.protein += entry.foodItem.proteinPer100g * factor;
      totals.carbs += entry.foodItem.carbsPer100g * factor;
      totals.fat += entry.foodItem.fatPer100g * factor;
      byDay.set(key, totals);
    }
    for (const [day, t] of byDay) {
      lines.push(
        `- ${day}: ${Math.round(t.cal)} kcal, eiwit ${Math.round(t.protein)}g, koolh. ${Math.round(t.carbs)}g, vet ${Math.round(t.fat)}g`
      );
    }
  }

  // Body metrics
  lines.push("\n## Lichaamsgewicht (recentste metingen)");
  if (bodyMetrics.length === 0) {
    lines.push("Geen gewicht gelogd.");
  } else {
    for (const m of [...bodyMetrics].reverse()) {
      lines.push(`- ${fmtDate(m.date)}: ${m.weightKg}kg${m.bodyFatPct ? ` (${m.bodyFatPct}% vet)` : ""}`);
    }
    const oldest = bodyMetrics[bodyMetrics.length - 1];
    const newest = bodyMetrics[0];
    const days = (newest.date.getTime() - oldest.date.getTime()) / (1000 * 60 * 60 * 24);
    if (days >= 6) {
      const kgPerWeek = ((newest.weightKg - oldest.weightKg) / days) * 7;
      const pctPerWeek = (kgPerWeek / oldest.weightKg) * 100;
      lines.push(
        `Trend: ${kgPerWeek >= 0 ? "+" : ""}${kgPerWeek.toFixed(2)}kg/week (${pctPerWeek.toFixed(2)}%/week) over ${Math.round(days)} dagen.`
      );
    }
  }

  return lines.join("\n");
}
