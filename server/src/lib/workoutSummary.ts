import { prisma } from "../db.js";
import { computeWeeklyStreak } from "../gamification/achievements.js";
import { computeXpTotal } from "../gamification/xpTotals.js";
import { XP, levelFromXp, levelTitle, weeklySessionTarget } from "../gamification/xp.js";
import { estimate1RM } from "./strength.js";
import { dayKeyOf, weekStartKey, addDaysKey } from "./tz.js";

const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

function coachLine(args: { prs: number; deltaPct: number | null; sets: number; streakWeeks: number; levelUp: boolean }): string {
  if (args.levelUp) return "Level up. Zo bouw je dat fundament, bro. Hou dit ritme vast.";
  if (args.prs >= 2) return `${args.prs} records in één training. Dit is precies hoe je breder wordt.`;
  if (args.prs === 1) return "Nieuw record. Eén stap vooruit is meer dan een slechte week thuis.";
  if (args.deltaPct !== null && args.deltaPct >= 5) return `Volume ${round(args.deltaPct)}% hoger dan vorige keer. Progressie is progressie.`;
  if (args.deltaPct !== null && args.deltaPct <= -15) return "Wat minder volume dan vorige keer. Geen drama: slaap, eet goed, pak de volgende sessie hard aan.";
  if (args.streakWeeks >= 4) return `${args.streakWeeks} weken op rij getraind. Dat consistente werk is wat het verschil maakt.`;
  if (args.sets >= 12) return "Stevige sessie. Genoeg gedaan, nu eten en slapen.";
  return "Training gelogd. Elke sessie telt, ook als hij gewoon solide is.";
}

/** Everything the "training klaar" screen shows: totals, per-exercise results compared to
 * last time, new records, XP/level change and the week so far. */
export async function buildWorkoutSummary(userId: string, sessionId: string, tz: number) {
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      programDay: { select: { name: true } },
      setLogs: { orderBy: { createdAt: "asc" }, include: { exercise: { select: { id: true, name: true, muscleGroup: true } } } },
    },
  });
  if (!session) return null;

  const working = session.setLogs.filter((s) => !s.isWarmup);
  const volumeKg = Math.round(working.reduce((v, s) => v + s.weight * s.reps, 0));
  const prSets = working.filter((s) => s.isPR);

  // previous session of the same program day (else of any training) for comparison
  const previous = await prisma.workoutSession.findFirst({
    where: {
      userId,
      id: { not: session.id },
      date: { lt: session.date },
      ...(session.programDayId ? { programDayId: session.programDayId } : {}),
    },
    orderBy: { date: "desc" },
    include: { setLogs: { where: { isWarmup: false }, include: { exercise: { select: { id: true, name: true } } } } },
  });
  const prevVolume = previous ? Math.round(previous.setLogs.reduce((v, s) => v + s.weight * s.reps, 0)) : null;
  const deltaPct = prevVolume && prevVolume > 0 ? ((volumeKg - prevVolume) / prevVolume) * 100 : null;

  const byExercise = new Map<string, typeof working>();
  for (const s of working) byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s]);
  const prevByExercise = new Map<string, NonNullable<typeof previous>["setLogs"]>();
  for (const s of previous?.setLogs ?? []) prevByExercise.set(s.exerciseId, [...(prevByExercise.get(s.exerciseId) ?? []), s]);

  const exercises = [...byExercise.entries()].map(([exerciseId, sets]) => {
    const best = sets.reduce((a, b) => (estimate1RM(b.weight, b.reps) > estimate1RM(a.weight, a.reps) ? b : a));
    const prevSets = prevByExercise.get(exerciseId);
    const prevBest = prevSets?.length ? prevSets.reduce((a, b) => (estimate1RM(b.weight, b.reps) > estimate1RM(a.weight, a.reps) ? b : a)) : null;
    const vol = Math.round(sets.reduce((v, s) => v + s.weight * s.reps, 0));
    return {
      exerciseId,
      name: sets[0].exercise.name,
      sets: sets.map((s) => ({ weight: s.weight, reps: s.reps, rpe: s.rpe, isPR: s.isPR })),
      best: { weight: best.weight, reps: best.reps },
      volumeKg: vol,
      lastBest: prevBest ? { weight: prevBest.weight, reps: prevBest.reps } : null,
      e1rmDelta: prevBest ? round(estimate1RM(best.weight, best.reps) - estimate1RM(prevBest.weight, prevBest.reps), 1) : null,
    };
  });

  // duration: start until the last logged set (or finish), so a forgotten "Klaar" doesn't show hours
  const lastSetAt = session.setLogs.length ? session.setLogs[session.setLogs.length - 1].createdAt : null;
  const end = session.finishedAt ?? lastSetAt ?? session.date;
  const capped = lastSetAt && session.finishedAt && session.finishedAt.getTime() > lastSetAt.getTime() + 20 * 60_000 ? new Date(lastSetAt.getTime() + 5 * 60_000) : end;
  const durationMin = Math.max(1, Math.round((capped.getTime() - session.date.getTime()) / 60_000));

  // XP for this session and what it did to the level
  const gained = XP.workout + working.length * XP.set + prSets.length * XP.pr;
  const xpAfter = await computeXpTotal(userId, tz);
  const xpBefore = Math.max(0, xpAfter - gained);
  const before = levelFromXp(xpBefore);
  const after = levelFromXp(xpAfter);

  // the week so far
  const todayKey = dayKeyOf(session.date, tz);
  const weekStart = weekStartKey(todayKey);
  const [weekSessions, planned, profile] = await Promise.all([
    prisma.workoutSession.findMany({ where: { userId }, select: { date: true } }),
    prisma.plannedWorkout.count({ where: { userId, date: { gte: weekStart, lte: addDaysKey(weekStart, 6) } } }),
    prisma.userProfile.findUnique({ where: { userId }, select: { trainDays: true } }),
  ]);
  const thisWeek = weekSessions.filter((s) => weekStartKey(dayKeyOf(s.date, tz)) === weekStart).length;
  const streakWeeks = computeWeeklyStreak(weekSessions.map((s) => s.date), tz, session.date);

  return {
    session: {
      id: session.id,
      name: session.programDay?.name ?? "Vrije training",
      date: session.date,
      finishedAt: session.finishedAt,
      durationMin,
    },
    totals: { sets: working.length, warmupSets: session.setLogs.length - working.length, volumeKg, exercises: exercises.length, reps: working.reduce((n, s) => n + s.reps, 0) },
    exercises,
    prs: prSets.map((s) => ({ exercise: s.exercise.name, weight: s.weight, reps: s.reps })),
    previous: previous ? { date: previous.date, volumeKg: prevVolume, deltaPct: deltaPct === null ? null : round(deltaPct, 1) } : null,
    xp: {
      gained,
      before: xpBefore,
      after: xpAfter,
      levelBefore: before.level,
      levelAfter: after.level,
      leveledUp: after.level > before.level,
      title: levelTitle(after.level),
      levelStartXp: after.currentLevelXp,
      nextLevelXp: after.nextLevelXp,
    },
    week: { sessions: thisWeek, target: weeklySessionTarget(planned, profile?.trainDays), streakWeeks },
    coachLine: coachLine({
      prs: prSets.length,
      deltaPct,
      sets: working.length,
      streakWeeks,
      levelUp: after.level > before.level,
    }),
  };
}
