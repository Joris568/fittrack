import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../auth/middleware.js";
import { getVapidKeys, sendToUser } from "../lib/pushKeys.js";
import { parseTimeOfDay } from "../lib/reminderTiming.js";

export const pushRouter = Router();

pushRouter.get("/public-key", async (_req, res) => {
  res.json({ publicKey: (await getVapidKeys()).publicKey });
});

const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(5).max(200) }),
});

pushRouter.post("/subscribe", async (req: AuthedRequest, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Ongeldig abonnement" });
  const { endpoint, keys } = parsed.data;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: req.userId!, p256dh: keys.p256dh, auth: keys.auth },
    create: { userId: req.userId!, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });
  await prisma.reminderSettings.upsert({ where: { userId: req.userId! }, update: {}, create: { userId: req.userId! } });
  res.status(201).json({ ok: true });
});

pushRouter.post("/unsubscribe", async (req: AuthedRequest, res) => {
  const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : "";
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.userId } });
  res.json({ ok: true });
});

const time = z.string().refine((v) => parseTimeOfDay(v) !== null, "Tijd als HH:MM");
const settingsSchema = z
  .object({
    trainingOn: z.boolean(),
    trainingTime: time,
    weighOn: z.boolean(),
    weighTime: time,
    foodOn: z.boolean(),
    foodTime: time,
    weeklyOn: z.boolean(),
  })
  .partial();

async function currentSettings(userId: string) {
  const [settings, devices] = await Promise.all([
    prisma.reminderSettings.upsert({ where: { userId }, update: {}, create: { userId } }),
    prisma.pushSubscription.count({ where: { userId } }),
  ]);
  const { sentLog: _sentLog, id: _id, userId: _uid, ...rest } = settings;
  return { settings: rest, devices };
}

pushRouter.get("/settings", async (req: AuthedRequest, res) => {
  res.json(await currentSettings(req.userId!));
});

pushRouter.put("/settings", async (req: AuthedRequest, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Ongeldige instellingen" });
  await prisma.reminderSettings.upsert({ where: { userId: req.userId! }, update: parsed.data, create: { userId: req.userId!, ...parsed.data } });
  res.json(await currentSettings(req.userId!));
});

pushRouter.post("/test", async (req: AuthedRequest, res) => {
  const sent = await sendToUser(req.userId!, { title: "FitTrack", body: "Meldingen werken. Dit is een test.", url: "/", tag: "test" });
  res.json({ sent });
});
