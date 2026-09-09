import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../auth/middleware.js";

export const goalsRouter = Router();

goalsRouter.get("/current", async (req: AuthedRequest, res) => {
  const goal = await prisma.nutritionGoal.findFirst({
    where: { userId: req.userId, effectiveFrom: { lte: new Date() } },
    orderBy: { effectiveFrom: "desc" },
  });
  res.json(goal);
});

goalsRouter.get("/", async (req: AuthedRequest, res) => {
  const goals = await prisma.nutritionGoal.findMany({
    where: { userId: req.userId },
    orderBy: { effectiveFrom: "desc" },
  });
  res.json(goals);
});

const goalSchema = z.object({
  calories: z.number().int().min(0),
  proteinGrams: z.number().int().min(0),
  carbsGrams: z.number().int().min(0),
  fatGrams: z.number().int().min(0),
  effectiveFrom: z.string().datetime().optional(),
});

goalsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = goalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const goal = await prisma.nutritionGoal.create({
    data: {
      userId: req.userId!,
      ...parsed.data,
      effectiveFrom: parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : undefined,
    },
  });
  res.status(201).json(goal);
});
