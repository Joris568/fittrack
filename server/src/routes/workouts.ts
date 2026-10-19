import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../auth/middleware.js";
import { checkAndUnlockAchievements } from "../gamification/achievements.js";
import { isPersonalRecord } from "../lib/strength.js";
import { buildWorkoutSummary } from "../lib/workoutSummary.js";

export const workoutsRouter = Router();

workoutsRouter.get("/", async (req: AuthedRequest, res) => {
  const take = req.query.take ? Number(req.query.take) : 20;
  const skip = req.query.skip ? Number(req.query.skip) : 0;
  const sessions = await prisma.workoutSession.findMany({
    where: { userId: req.userId },
    orderBy: { date: "desc" },
    take,
    skip,
    include: {
      programDay: { include: { program: true } },
      setLogs: { include: { exercise: true } },
    },
  });
  res.json(sessions);
});

workoutsRouter.get("/exercise/:exerciseId/history", async (req: AuthedRequest, res) => {
  const setLogs = await prisma.setLog.findMany({
    where: {
      exerciseId: req.params.exerciseId,
      workoutSession: { userId: req.userId },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { workoutSession: true },
  });
  res.json(setLogs);
});

workoutsRouter.get("/:id", async (req: AuthedRequest, res) => {
  const session = await prisma.workoutSession.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: {
      programDay: { include: { program: true, exercises: { include: { exercise: true } } } },
      setLogs: { include: { exercise: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!session) return res.status(404).json({ error: "Not found" });
  res.json(session);
});

const createSessionSchema = z.object({
  programDayId: z.string().optional(),
  notes: z.string().optional(),
  date: z.string().datetime().optional(),
  layout: z.string().max(8000).optional(),
});

workoutsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const session = await prisma.workoutSession.create({
    data: {
      userId: req.userId!,
      programDayId: parsed.data.programDayId,
      notes: parsed.data.notes,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
    },
  });
  const newAchievements = await checkAndUnlockAchievements(req.userId!);
  res.status(201).json({ ...session, newAchievements });
});

workoutsRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = createSessionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const result = await prisma.workoutSession.updateMany({
    where: { id: req.params.id, userId: req.userId },
    data: {
      notes: parsed.data.notes,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
      layout: parsed.data.layout,
    },
  });
  if (result.count === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

/** Marks a training as finished (first call wins) and returns the summary for the celebration screen. */
workoutsRouter.post("/:id/finish", async (req: AuthedRequest, res) => {
  const session = await prisma.workoutSession.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!session) return res.status(404).json({ error: "Not found" });
  if (!session.finishedAt) await prisma.workoutSession.update({ where: { id: session.id }, data: { finishedAt: new Date() } });
  await checkAndUnlockAchievements(req.userId!);
  res.json(await buildWorkoutSummary(req.userId!, session.id, req.tz));
});

workoutsRouter.get("/:id/summary", async (req: AuthedRequest, res) => {
  const summary = await buildWorkoutSummary(req.userId!, req.params.id, req.tz);
  if (!summary) return res.status(404).json({ error: "Not found" });
  res.json(summary);
});

workoutsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  await prisma.workoutSession.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  res.json({ ok: true });
});

const setLogSchema = z.object({
  exerciseId: z.string().min(1),
  setNumber: z.number().int().min(1),
  reps: z.number().int().min(0),
  weight: z.number().min(0),
  rpe: z.number().min(1).max(10).optional(),
  notes: z.string().optional(),
  clientId: z.string().min(8).max(64).optional(),
  isWarmup: z.boolean().optional(),
});

workoutsRouter.post("/:id/sets", async (req: AuthedRequest, res) => {
  const parsed = setLogSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const session = await prisma.workoutSession.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!session) return res.status(404).json({ error: "Not found" });

  // Retried request (e.g. flushed from the offline queue after the first attempt actually
  // got through): hand back the set that already exists instead of logging it twice.
  if (parsed.data.clientId) {
    const existing = await prisma.setLog.findFirst({ where: { clientId: parsed.data.clientId, workoutSession: { userId: req.userId } }, include: { exercise: true } });
    if (existing) return res.status(200).json({ ...existing, newAchievements: [] });
  }

  // A record = a higher estimated 1RM than any earlier set (so more reps at the same
  // weight counts too, not only a heavier weight).
  const previousSets = await prisma.setLog.findMany({
    where: { exerciseId: parsed.data.exerciseId, isWarmup: false, workoutSession: { userId: req.userId } },
    select: { weight: true, reps: true },
  });
  const isPR = !parsed.data.isWarmup && isPersonalRecord(previousSets, parsed.data);

  const setLog = await prisma.setLog.create({
    data: { workoutSessionId: session.id, ...parsed.data, isPR },
    include: { exercise: true },
  });
  const newAchievements = await checkAndUnlockAchievements(req.userId!);
  res.status(201).json({ ...setLog, newAchievements });
});

workoutsRouter.patch("/sets/:setId", async (req: AuthedRequest, res) => {
  const parsed = setLogSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const setLog = await prisma.setLog.findFirst({
    where: { id: req.params.setId, workoutSession: { userId: req.userId } },
  });
  if (!setLog) return res.status(404).json({ error: "Not found" });
  await prisma.setLog.update({ where: { id: setLog.id }, data: parsed.data });
  res.json({ ok: true });
});

workoutsRouter.delete("/sets/:setId", async (req: AuthedRequest, res) => {
  const setLog = await prisma.setLog.findFirst({
    where: { id: req.params.setId, workoutSession: { userId: req.userId } },
  });
  if (!setLog) return res.status(404).json({ error: "Not found" });
  await prisma.setLog.delete({ where: { id: setLog.id } });
  res.json({ ok: true });
});
