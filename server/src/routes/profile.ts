import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../auth/middleware.js";
import { computeInsights } from "../lib/profileInsights.js";

export const profileRouter = Router();

const nullable = <T extends z.ZodTypeAny>(s: T) => s.nullable().optional();

export const profileSchema = z.object({
  heightCm: nullable(z.number().int().min(120).max(230)),
  birthYear: nullable(z.number().int().min(1930).max(new Date().getFullYear() - 10)),
  sex: nullable(z.enum(["male", "female"])),
  activity: nullable(z.enum(["sedentary", "light", "moderate", "active", "very_active"])),
  goal: nullable(z.enum(["bulk", "cut", "maintain"])),
  experience: nullable(z.enum(["beginner", "intermediate", "advanced"])),
  trainDays: nullable(z.number().int().min(1).max(7)),
  injuries: nullable(z.string().max(300)),
  coachNotes: z.array(z.string().trim().min(1).max(200)).max(40).optional(),
});

profileRouter.get("/", async (req: AuthedRequest, res) => {
  const { profile, notes, ...insights } = await computeInsights(req.userId!);
  res.json({ profile: profile ? { ...profile, coachNotes: undefined } : null, notes, insights });
});

profileRouter.put("/", async (req: AuthedRequest, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { coachNotes, ...fields } = parsed.data;
  const data = { ...fields, ...(coachNotes ? { coachNotes: JSON.stringify(coachNotes) } : {}) };
  await prisma.userProfile.upsert({
    where: { userId: req.userId! },
    update: data,
    create: { userId: req.userId!, ...data },
  });
  const { profile, notes, ...insights } = await computeInsights(req.userId!);
  res.json({ profile: profile ? { ...profile, coachNotes: undefined } : null, notes, insights });
});
