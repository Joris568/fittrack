import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../auth/middleware.js";

export const progressPhotosRouter = Router();

progressPhotosRouter.get("/", async (req: AuthedRequest, res) => {
  const photos = await prisma.progressPhoto.findMany({
    where: { userId: req.userId },
    orderBy: { date: "desc" },
    take: 100,
  });
  res.json(photos);
});

const photoSchema = z.object({
  imageData: z.string().min(1).refine((v) => v.startsWith("data:image/"), "Moet een afbeelding zijn"),
  notes: z.string().optional(),
  date: z.string().datetime().optional(),
});

progressPhotosRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = photoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  // Personal-app scale only — a data URL stored per row keeps this simple with
  // no external file storage, but isn't meant for hundreds of high-res photos.
  if (parsed.data.imageData.length > 3_000_000) {
    return res.status(413).json({ error: "Afbeelding is te groot (max ~2MB)." });
  }
  const photo = await prisma.progressPhoto.create({
    data: {
      userId: req.userId!,
      imageData: parsed.data.imageData,
      notes: parsed.data.notes,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
    },
  });
  res.status(201).json(photo);
});

progressPhotosRouter.delete("/:id", async (req: AuthedRequest, res) => {
  await prisma.progressPhoto.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  res.json({ ok: true });
});
