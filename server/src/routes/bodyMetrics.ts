import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../auth/middleware.js";

export const bodyMetricsRouter = Router();

bodyMetricsRouter.get("/", async (req: AuthedRequest, res) => {
  const metrics = await prisma.bodyMetric.findMany({
    where: { userId: req.userId },
    orderBy: { date: "desc" },
    take: 180,
  });
  res.json(metrics);
});

const metricSchema = z.object({
  weightKg: z.number().min(0),
  bodyFatPct: z.number().min(0).max(100).optional(),
  waistCm: z.number().min(0).optional(),
  chestCm: z.number().min(0).optional(),
  armCm: z.number().min(0).optional(),
  thighCm: z.number().min(0).optional(),
  hipCm: z.number().min(0).optional(),
  date: z.string().datetime().optional(),
});

bodyMetricsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = metricSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const metric = await prisma.bodyMetric.create({
    data: {
      userId: req.userId!,
      ...parsed.data,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
    },
  });
  res.status(201).json(metric);
});

bodyMetricsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  await prisma.bodyMetric.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  res.json({ ok: true });
});
