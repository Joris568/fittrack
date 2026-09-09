import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../auth/middleware.js";

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
  res.status(201).json(session);
});

workoutsRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = createSessionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const result = await prisma.workoutSession.updateMany({
    where: { id: req.params.id, userId: req.userId },
    data: {
      notes: parsed.data.notes,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
    },
  });
  if (result.count === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
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
});

workoutsRouter.post("/:id/sets", async (req: AuthedRequest, res) => {
  const parsed = setLogSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const session = await prisma.workoutSession.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!session) return res.status(404).json({ error: "Not found" });
  const setLog = await prisma.setLog.create({
    data: { workoutSessionId: session.id, ...parsed.data },
    include: { exercise: true },
  });
  res.status(201).json(setLog);
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
