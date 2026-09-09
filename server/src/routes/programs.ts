import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../auth/middleware.js";

export const programsRouter = Router();

programsRouter.get("/", async (req: AuthedRequest, res) => {
  const programs = await prisma.workoutProgram.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    include: { days: { include: { exercises: true } } },
  });
  res.json(programs);
});

programsRouter.get("/:id", async (req: AuthedRequest, res) => {
  const program = await prisma.workoutProgram.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: {
      days: {
        orderBy: { order: "asc" },
        include: { exercises: { orderBy: { order: "asc" }, include: { exercise: true } } },
      },
    },
  });
  if (!program) return res.status(404).json({ error: "Not found" });
  res.json(program);
});

const programSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

programsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = programSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const program = await prisma.workoutProgram.create({
    data: { ...parsed.data, userId: req.userId! },
  });
  res.status(201).json(program);
});

programsRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = programSchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const program = await prisma.workoutProgram.updateMany({
    where: { id: req.params.id, userId: req.userId },
    data: parsed.data,
  });
  if (program.count === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

programsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  await prisma.workoutProgram.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  res.json({ ok: true });
});

// ----- Program days -----

const daySchema = z.object({
  name: z.string().min(1),
  order: z.number().int().optional(),
});

programsRouter.post("/:id/days", async (req: AuthedRequest, res) => {
  const parsed = daySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const program = await prisma.workoutProgram.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!program) return res.status(404).json({ error: "Not found" });
  const day = await prisma.programDay.create({
    data: { programId: program.id, name: parsed.data.name, order: parsed.data.order ?? 0 },
  });
  res.status(201).json(day);
});

programsRouter.patch("/days/:dayId", async (req: AuthedRequest, res) => {
  const parsed = daySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const day = await prisma.programDay.findFirst({
    where: { id: req.params.dayId, program: { userId: req.userId } },
  });
  if (!day) return res.status(404).json({ error: "Not found" });
  await prisma.programDay.update({ where: { id: day.id }, data: parsed.data });
  res.json({ ok: true });
});

programsRouter.delete("/days/:dayId", async (req: AuthedRequest, res) => {
  const day = await prisma.programDay.findFirst({
    where: { id: req.params.dayId, program: { userId: req.userId } },
  });
  if (!day) return res.status(404).json({ error: "Not found" });
  await prisma.programDay.delete({ where: { id: day.id } });
  res.json({ ok: true });
});

// ----- Program exercises -----

const programExerciseSchema = z.object({
  exerciseId: z.string().min(1),
  order: z.number().int().optional(),
  targetSets: z.number().int().min(1).optional(),
  targetRepsMin: z.number().int().min(1).optional(),
  targetRepsMax: z.number().int().min(1).optional(),
  targetWeight: z.number().optional(),
  targetRpe: z.number().optional(),
  notes: z.string().optional(),
});

programsRouter.post("/days/:dayId/exercises", async (req: AuthedRequest, res) => {
  const parsed = programExerciseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const day = await prisma.programDay.findFirst({
    where: { id: req.params.dayId, program: { userId: req.userId } },
  });
  if (!day) return res.status(404).json({ error: "Not found" });
  const pe = await prisma.programExercise.create({
    data: { programDayId: day.id, ...parsed.data },
    include: { exercise: true },
  });
  res.status(201).json(pe);
});

programsRouter.patch("/exercises/:peId", async (req: AuthedRequest, res) => {
  const parsed = programExerciseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const pe = await prisma.programExercise.findFirst({
    where: { id: req.params.peId, programDay: { program: { userId: req.userId } } },
  });
  if (!pe) return res.status(404).json({ error: "Not found" });
  await prisma.programExercise.update({ where: { id: pe.id }, data: parsed.data });
  res.json({ ok: true });
});

programsRouter.delete("/exercises/:peId", async (req: AuthedRequest, res) => {
  const pe = await prisma.programExercise.findFirst({
    where: { id: req.params.peId, programDay: { program: { userId: req.userId } } },
  });
  if (!pe) return res.status(404).json({ error: "Not found" });
  await prisma.programExercise.delete({ where: { id: pe.id } });
  res.json({ ok: true });
});
