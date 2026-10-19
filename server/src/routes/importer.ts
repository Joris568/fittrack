import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../auth/middleware.js";
import { aliasFor, guessMuscleGroup, parseWorkoutCsv } from "../lib/csvImport.js";
import { isPersonalRecord } from "../lib/strength.js";
import { checkAndUnlockAchievements } from "../gamification/achievements.js";

export const importRouter = Router();

const bodySchema = z.object({ csv: z.string().min(20).max(4_000_000), unit: z.enum(["kg", "lbs"]).optional() });
const MAX_SESSIONS = 1500;

/** Brings workout history over from Strong or Hevy (CSV export) so suggestions, records and
 * charts work from day one. Safe to run twice: a session that is already imported is skipped. */
importRouter.post("/workouts", async (req: AuthedRequest, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Geen geldig CSV-bestand meegestuurd." });
  const userId = req.userId!;

  const result = parseWorkoutCsv(parsed.data.csv, req.tz, parsed.data.unit ?? "kg");
  if (result.error) return res.status(400).json({ error: result.error });
  if (result.sessions.length === 0) return res.status(400).json({ error: "Geen trainingen gevonden in dit bestand." });
  if (result.sessions.length > MAX_SESSIONS) return res.status(400).json({ error: `Te veel trainingen in één keer (max ${MAX_SESSIONS}).` });

  const exercises = await prisma.exercise.findMany();
  const byLower = new Map(exercises.map((e) => [e.name.toLowerCase(), e]));
  const createdNames: string[] = [];
  const resolve = async (rawName: string) => {
    const wanted = aliasFor(rawName) ?? rawName.replace(/\s+/g, " ").trim();
    const hit = byLower.get(wanted.toLowerCase()) ?? byLower.get(rawName.trim().toLowerCase());
    if (hit) return hit;
    const created = await prisma.exercise.create({ data: { name: wanted, muscleGroup: guessMuscleGroup(rawName), isCustom: true } });
    byLower.set(created.name.toLowerCase(), created);
    createdNames.push(created.name);
    return created;
  };

  const already = await prisma.workoutSession.findMany({ where: { userId, notes: { startsWith: "Import:" } }, select: { date: true, notes: true } });
  const doneKeys = new Set(already.map((s) => `${s.date.getTime()}|${s.notes}`));

  // earlier working sets per exercise, so records are judged against real history
  const history = new Map<string, { weight: number; reps: number }[]>();
  const prior = await prisma.setLog.findMany({ where: { isWarmup: false, workoutSession: { userId } }, select: { exerciseId: true, weight: true, reps: true } });
  for (const s of prior) history.set(s.exerciseId, [...(history.get(s.exerciseId) ?? []), { weight: s.weight, reps: s.reps }]);

  let sessionsCreated = 0;
  let setsCreated = 0;
  let duplicates = 0;
  for (const s of result.sessions) {
    const notes = `Import: ${s.name}`;
    if (doneKeys.has(`${s.date.getTime()}|${notes}`)) {
      duplicates++;
      continue;
    }
    const perExercise = new Map<string, number>();
    const setRows = [];
    let i = 0;
    for (const set of s.sets) {
      const exercise = await resolve(set.exerciseName);
      const n = (perExercise.get(exercise.id) ?? 0) + 1;
      perExercise.set(exercise.id, n);
      const prev = history.get(exercise.id) ?? [];
      const isPR = !set.isWarmup && isPersonalRecord(prev, set);
      if (!set.isWarmup) history.set(exercise.id, [...prev, { weight: set.weight, reps: set.reps }]);
      setRows.push({
        exerciseId: exercise.id,
        setNumber: n,
        reps: set.reps,
        weight: set.weight,
        rpe: set.rpe,
        isWarmup: set.isWarmup,
        isPR,
        // keep the original order and make it older than anything logged in the app
        createdAt: new Date(s.date.getTime() + i++ * 1000),
      });
    }
    await prisma.workoutSession.create({
      data: { userId, date: s.date, finishedAt: new Date(s.date.getTime() + 3600_000), notes, setLogs: { create: setRows } },
    });
    sessionsCreated++;
    setsCreated += setRows.length;
  }

  await checkAndUnlockAchievements(userId);
  res.status(201).json({ sessions: sessionsCreated, sets: setsCreated, newExercises: createdNames, skippedRows: result.skippedRows, duplicateSessions: duplicates });
});
