import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const exercisesRouter = Router();

exercisesRouter.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.toLowerCase() : undefined;
  const exercises = await prisma.exercise.findMany({ orderBy: { name: "asc" } });
  res.json(q ? exercises.filter((e) => e.name.toLowerCase().includes(q)) : exercises);
});

const createSchema = z.object({
  name: z.string().min(1),
  muscleGroup: z.string().min(1),
  equipment: z.string().optional(),
  notes: z.string().optional(),
});

exercisesRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const exercise = await prisma.exercise.create({
    data: { ...parsed.data, isCustom: true },
  });
  res.status(201).json(exercise);
});

exercisesRouter.delete("/:id", async (req, res) => {
  await prisma.exercise.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
