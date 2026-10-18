import { Router } from "express";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../auth/middleware.js";
import { dayKeyOf } from "../lib/tz.js";

export const exportRouter = Router();

/** Full JSON back-up of the user's data. Photos (large base64) only with ?photos=1. */
exportRouter.get("/", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const withPhotos = req.query.photos === "1";
  const [programs, sessions, foodLogs, goals, bodyMetrics, planned, recipes, achievements, chat, photos] = await Promise.all([
    prisma.workoutProgram.findMany({ where: { userId }, include: { days: { include: { exercises: { include: { exercise: true } } } } } }),
    prisma.workoutSession.findMany({ where: { userId }, orderBy: { date: "asc" }, include: { setLogs: { include: { exercise: { select: { name: true } } } } } }),
    prisma.foodLogEntry.findMany({ where: { userId }, orderBy: { date: "asc" }, include: { foodItem: true } }),
    prisma.nutritionGoal.findMany({ where: { userId } }),
    prisma.bodyMetric.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.plannedWorkout.findMany({ where: { userId } }),
    prisma.recipe.findMany({ where: { userId } }),
    prisma.achievement.findMany({ where: { userId } }),
    prisma.chatMessage.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { role: true, content: true, createdAt: true } }),
    withPhotos
      ? prisma.progressPhoto.findMany({ where: { userId }, orderBy: { date: "asc" } })
      : prisma.progressPhoto.findMany({ where: { userId }, orderBy: { date: "asc" }, select: { id: true, date: true, notes: true } }),
  ]);
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), programs, sessions, foodLogs, goals, bodyMetrics, planned, recipes, achievements, chat, progressPhotos: photos }, null, 2);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="fittrack-backup-${dayKeyOf(new Date(), req.tz)}${withPhotos ? "-met-fotos" : ""}.json"`);
  res.send(body);
});

/** How much space photos and chat attachments take, so the free database doesn't fill up unnoticed. */
exportRouter.get("/storage", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const bytes = async (sql: string) => {
    const rows = (await prisma.$queryRawUnsafe(sql, userId)) as { n: number | bigint | null }[];
    return Number(rows[0]?.n ?? 0);
  };
  const [photoBytes, chatBytes, photoCount] = await Promise.all([
    bytes(`SELECT COALESCE(SUM(LENGTH("imageData")), 0) AS n FROM "ProgressPhoto" WHERE "userId" = ${prismaParam()}`),
    bytes(`SELECT COALESCE(SUM(LENGTH("images")), 0) AS n FROM "ChatMessage" WHERE "userId" = ${prismaParam()}`),
    prisma.progressPhoto.count({ where: { userId } }),
  ]);
  res.json({ photoCount, photoBytes, chatImageBytes: chatBytes });
});

// SQLite uses ?, Postgres uses $1 — pick by the active datasource.
function prismaParam() {
  return (process.env.DATABASE_URL ?? "").startsWith("file:") ? "?" : "$1";
}
