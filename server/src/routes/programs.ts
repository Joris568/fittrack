import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../auth/middleware.js";
import { checkAndUnlockAchievements } from "../gamification/achievements.js";
import { detectPlateaus } from "../lib/plateau.js";
import { makeExerciseResolver } from "../lib/exerciseResolver.js";

export const programsRouter = Router();

programsRouter.get("/", async (req: AuthedRequest, res) => {
  const programs = await prisma.workoutProgram.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    include: { days: { include: { exercises: true } } },
  });
  res.json(programs);
});

// Must be registered before "/:id" — otherwise the param route would swallow this path.
programsRouter.get("/plateaus", async (req: AuthedRequest, res) => {
  res.json(await detectPlateaus(req.userId!));
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
  const newAchievements = await checkAndUnlockAchievements(req.userId!);
  res.status(201).json({ ...program, newAchievements });
});

const importSchema = z.object({
  programName: z.string().min(1),
  days: z.array(
    z.object({
      name: z.string().min(1),
      exercises: z.array(
        z.object({
          exerciseName: z.string().min(1),
          targetSets: z.number().int().min(1),
          targetRepsMin: z.number().int().min(1),
          targetRepsMax: z.number().int().min(1),
          targetWeight: z.number().optional(),
        })
      ),
    })
  ),
});

/** Saves an AI-parsed program (see /api/ai/program/parse), resolving each
 * exercise name to an existing Exercise or creating a new custom one. */
programsRouter.post("/import", async (req: AuthedRequest, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const resolveExercise = makeExerciseResolver();

  const program = await prisma.workoutProgram.create({
    data: { userId: req.userId!, name: parsed.data.programName },
  });

  for (const [dayIndex, day] of parsed.data.days.entries()) {
    const createdDay = await prisma.programDay.create({
      data: { programId: program.id, name: day.name, order: dayIndex },
    });
    for (const [exIndex, ex] of day.exercises.entries()) {
      const exercise = await resolveExercise(ex.exerciseName);
      await prisma.programExercise.create({
        data: {
          programDayId: createdDay.id,
          exerciseId: exercise.id,
          order: exIndex,
          targetSets: ex.targetSets,
          targetRepsMin: ex.targetRepsMin,
          targetRepsMax: ex.targetRepsMax,
          targetWeight: ex.targetWeight,
        },
      });
    }
  }

  const newAchievements = await checkAndUnlockAchievements(req.userId!);
  res.status(201).json({ id: program.id, newAchievements });
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
