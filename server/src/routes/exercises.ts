import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../auth/middleware.js";
import { callClaudeJson } from "./ai/claudeClient.js";
import { staticGuideFor, youtubeSearchUrl, type ExerciseGuide } from "../lib/exerciseGuides.js";
import { estimate1RM } from "../lib/strength.js";
import { dayKeyOf } from "../lib/tz.js";

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

/** Your own reminder for an exercise ("stoel op 4", "smalle grip", a link to a form video). */
exercisesRouter.patch("/:id/note", async (req, res) => {
  const parsed = z.object({ note: z.string().max(400) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Notitie is te lang (max 400 tekens)." });
  const note = parsed.data.note.trim();
  await prisma.exercise.update({ where: { id: req.params.id }, data: { notes: note || null } });
  res.json({ notes: note || null });
});

exercisesRouter.delete("/:id", async (req, res) => {
  await prisma.exercise.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/** How-to for an exercise: the built-in guide if we have one, otherwise an AI-written one that
 * is cached on the exercise so it is only ever generated (and paid for) once. */
exercisesRouter.get("/:id/guide", async (req, res) => {
  const exercise = await prisma.exercise.findUnique({ where: { id: req.params.id } });
  if (!exercise) return res.status(404).json({ error: "Oefening niet gevonden" });
  const base = {
    exercise: { id: exercise.id, name: exercise.name, muscleGroup: exercise.muscleGroup, equipment: exercise.equipment },
    videoUrl: youtubeSearchUrl(exercise.name),
  };

  const builtIn = staticGuideFor(exercise.name);
  if (builtIn) return res.json({ ...base, guide: builtIn, source: "kennisbank" });

  if (exercise.guide) {
    try {
      return res.json({ ...base, guide: JSON.parse(exercise.guide) as ExerciseGuide, source: "ai" });
    } catch {
      // corrupt cache — regenerate below
    }
  }

  try {
    const guide = await callClaudeJson<ExerciseGuide>({
      system:
        "Je bent een ervaren krachttrainer. Leg een oefening kort, concreet en correct uit in het Nederlands voor iemand die hem in de sportschool gaat doen. Geen overdrijving, geen medische claims. Houd je aan gangbare, veilige techniek.",
      messages: [
        {
          role: "user",
          content: `Oefening: ${exercise.name}\nSpiergroep: ${exercise.muscleGroup}\nMateriaal: ${exercise.equipment ?? "onbekend"}\n\nGeef de uitleg.`,
        },
      ],
      toolName: "submit_exercise_guide",
      toolDescription: "Structured exercise explanation",
      inputSchema: {
        type: "object",
        properties: {
          muscles: {
            type: "object",
            properties: { primary: { type: "array", items: { type: "string" } }, secondary: { type: "array", items: { type: "string" } } },
            required: ["primary", "secondary"],
          },
          steps: { type: "array", items: { type: "string" }, description: "3-4 stappen uitvoering" },
          cues: { type: "array", items: { type: "string" }, description: "2-3 korte techniekcues" },
          mistakes: { type: "array", items: { type: "string" }, description: "2-3 veelgemaakte fouten" },
          tip: { type: "string", description: "Optioneel: één praktische tip" },
        },
        required: ["muscles", "steps", "cues", "mistakes"],
      },
      maxTokens: 900,
      label: "oefening-uitleg",
      fast: true,
    });
    await prisma.exercise.update({ where: { id: exercise.id }, data: { guide: JSON.stringify(guide) } });
    res.json({ ...base, guide, source: "ai" });
  } catch (err) {
    console.error("Exercise guide generation failed", err);
    res.json({ ...base, guide: null, source: "none" });
  }
});

/** Per-session history of one exercise (working sets only): best estimated 1RM, top set and
 * volume, oldest first, for a progress chart. */
exercisesRouter.get("/:id/progress", async (req: AuthedRequest, res) => {
  const sets = await prisma.setLog.findMany({
    where: { exerciseId: req.params.id, isWarmup: false, workoutSession: { userId: req.userId } },
    orderBy: { createdAt: "asc" },
    include: { workoutSession: { select: { id: true, date: true } } },
  });
  const bySession = new Map<string, typeof sets>();
  for (const s of sets) bySession.set(s.workoutSessionId, [...(bySession.get(s.workoutSessionId) ?? []), s]);
  const sessions = [...bySession.values()]
    .map((list) => {
      const top = list.reduce((a, b) => (estimate1RM(b.weight, b.reps) > estimate1RM(a.weight, a.reps) ? b : a));
      return {
        date: dayKeyOf(list[0].workoutSession.date, req.tz),
        e1rm: Math.round(estimate1RM(top.weight, top.reps) * 10) / 10,
        topWeight: top.weight,
        topReps: top.reps,
        volumeKg: Math.round(list.reduce((v, s) => v + s.weight * s.reps, 0)),
        sets: list.length,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-20);
  res.json({ sessions, prCount: sets.filter((s) => s.isPR).length });
});
