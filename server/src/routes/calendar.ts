import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../auth/middleware.js";
import { checkAndUnlockAchievements } from "../gamification/achievements.js";
import { addDaysKey, dayKeyOf, weekStartKey } from "../lib/tz.js";

export const calendarRouter = Router();

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Calendar data for a date range: what was trained, what is planned, and whether food
 * was logged, keyed by local day. Days are grouped in the user's timezone (tz = the
 * browser's getTimezoneOffset()), since the server runs in UTC. */
calendarRouter.get("/", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const from = dayKeySchema.safeParse(req.query.from);
  const to = dayKeySchema.safeParse(req.query.to);
  if (!from.success || !to.success) return res.status(400).json({ error: "from en to (YYYY-MM-DD) vereist" });
  const tz = Math.max(-840, Math.min(840, Number(req.query.tz) || 0));
  const dayKey = (d: Date) => dayKeyOf(d, tz);
  const rangeStart = new Date(new Date(`${from.data}T00:00:00Z`).getTime() + tz * 60_000);
  const rangeEnd = new Date(new Date(`${to.data}T00:00:00Z`).getTime() + tz * 60_000 + 86_400_000);

  const [sessions, planned, foodDates] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId, date: { gte: rangeStart, lt: rangeEnd } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        programDayId: true,
        programDay: { select: { name: true } },
        setLogs: { select: { weight: true, reps: true, isPR: true } },
      },
    }),
    prisma.plannedWorkout.findMany({
      where: { userId, date: { gte: from.data, lte: to.data } },
      orderBy: { createdAt: "asc" },
      include: { programDay: { select: { name: true, program: { select: { name: true } } } } },
    }),
    prisma.foodLogEntry.findMany({ where: { userId, date: { gte: rangeStart, lt: rangeEnd } }, select: { date: true } }),
  ]);

  type Day = {
    sessions: { id: string; name: string; sets: number; volumeKg: number; prs: number }[];
    planned: {
      id: string;
      title: string;
      programDayId: string | null;
      programName: string | null;
      notes: string | null;
      done: boolean;
    }[];
    foodLogged: boolean;
  };
  const days: Record<string, Day> = {};
  const day = (k: string) => (days[k] ??= { sessions: [], planned: [], foodLogged: false });

  const sessionIds = new Set(sessions.map((s) => s.id));
  const sessionsByDay = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const k = dayKey(s.date);
    sessionsByDay.set(k, [...(sessionsByDay.get(k) ?? []), s]);
    day(k).sessions.push({
      id: s.id,
      name: s.programDay?.name ?? "Vrije training",
      sets: s.setLogs.length,
      volumeKg: Math.round(s.setLogs.reduce((v, l) => v + l.weight * l.reps, 0)),
      prs: s.setLogs.filter((l) => l.isPR).length,
    });
  }
  for (const f of foodDates) day(dayKey(f.date)).foodLogged = true;

  for (const p of planned) {
    const sameDaySessions = sessionsByDay.get(p.date) ?? [];
    // Done = checked off by hand, started from the agenda, or a session of that same
    // program day was logged on that day (e.g. started from the dashboard instead).
    const done =
      p.done ||
      (!!p.sessionId && sessionIds.has(p.sessionId)) ||
      (!!p.programDayId && sameDaySessions.some((s) => s.programDayId === p.programDayId));
    day(p.date).planned.push({
      id: p.id,
      title: p.programDay?.name ?? p.title ?? "Training",
      programDayId: p.programDayId,
      programName: p.programDay?.program.name ?? null,
      notes: p.notes,
      done,
    });
  }

  res.json({ days });
});

const planSchema = z
  .object({
    date: dayKeySchema,
    programDayId: z.string().optional(),
    title: z.string().trim().min(1).max(80).optional(),
    notes: z.string().max(300).optional(),
    repeatWeeks: z.number().int().min(1).max(12).optional(), // same plan every week for N weeks
  })
  .refine((v) => v.programDayId || v.title, { message: "Kies een trainingsdag of geef een titel" });

calendarRouter.post("/planned", async (req: AuthedRequest, res) => {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.programDayId) {
    const owned = await prisma.programDay.findFirst({
      where: { id: parsed.data.programDayId, program: { userId: req.userId } },
    });
    if (!owned) return res.status(404).json({ error: "Trainingsdag niet gevonden" });
  }
  const { repeatWeeks, ...base } = parsed.data;
  let first;
  for (let i = 0; i < (repeatWeeks ?? 1); i++) {
    const row = await prisma.plannedWorkout.create({ data: { userId: req.userId!, ...base, date: addDaysKey(base.date, 7 * i) } });
    first ??= row;
  }
  res.status(201).json(first);
});

const planWeekSchema = z.object({
  programId: z.string(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7), // 0 = Monday
  weeks: z.number().int().min(1).max(12),
  startDate: dayKeySchema.optional(),
});

/** Schedules a program over chosen weekdays: its days are handed out in order and the
 * cycle carries on across weeks (e.g. Push/Pull/Legs on Mon/Wed/Fri → Push, Pull, Legs,
 * Push, ...). Days that already have that plan are skipped. */
calendarRouter.post("/plan-week", async (req: AuthedRequest, res) => {
  const parsed = planWeekSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const program = await prisma.workoutProgram.findFirst({
    where: { id: parsed.data.programId, userId: req.userId },
    include: { days: { orderBy: { order: "asc" } } },
  });
  if (!program || program.days.length === 0) return res.status(404).json({ error: "Programma niet gevonden of leeg" });

  const start = parsed.data.startDate ?? dayKeyOf(new Date(), req.tz);
  const weekdays = [...new Set(parsed.data.weekdays)].sort((a, b) => a - b);
  const existing = await prisma.plannedWorkout.findMany({
    where: { userId: req.userId, date: { gte: start, lte: addDaysKey(start, 7 * parsed.data.weeks + 7) } },
    select: { date: true, programDayId: true },
  });
  const taken = new Set(existing.map((e) => `${e.date}|${e.programDayId}`));

  let created = 0;
  let cycle = 0;
  const firstMonday = weekStartKey(start);
  for (let w = 0; w < parsed.data.weeks; w++) {
    for (const wd of weekdays) {
      const date = addDaysKey(firstMonday, w * 7 + wd);
      if (date < start) continue;
      const day = program.days[cycle % program.days.length];
      cycle++;
      if (taken.has(`${date}|${day.id}`)) continue;
      await prisma.plannedWorkout.create({ data: { userId: req.userId!, date, programDayId: day.id } });
      created++;
    }
  }
  res.status(201).json({ created });
});

const patchSchema = z.object({ date: dayKeySchema.optional(), done: z.boolean().optional(), notes: z.string().max(300).optional() });

calendarRouter.patch("/planned/:id", async (req: AuthedRequest, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const result = await prisma.plannedWorkout.updateMany({
    where: { id: req.params.id, userId: req.userId },
    data: parsed.data,
  });
  if (result.count === 0) return res.status(404).json({ error: "Niet gevonden" });
  res.json({ ok: true });
});

calendarRouter.delete("/planned/:id", async (req: AuthedRequest, res) => {
  await prisma.plannedWorkout.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  res.json({ ok: true });
});

/** Starts a planned workout: creates the session and links it, so the agenda shows it as done. */
calendarRouter.post("/planned/:id/start", async (req: AuthedRequest, res) => {
  const plan = await prisma.plannedWorkout.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!plan) return res.status(404).json({ error: "Niet gevonden" });
  const session = await prisma.workoutSession.create({
    data: { userId: req.userId!, programDayId: plan.programDayId ?? undefined },
  });
  await prisma.plannedWorkout.update({ where: { id: plan.id }, data: { sessionId: session.id } });
  const newAchievements = await checkAndUnlockAchievements(req.userId!);
  res.status(201).json({ ...session, newAchievements });
});
