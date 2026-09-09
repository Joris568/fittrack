import { Router } from "express";
import { prisma } from "../../db.js";
import type { AuthedRequest } from "../../auth/middleware.js";
import { buildUserContext } from "./contextBuilder.js";
import { callClaudeJson } from "./claudeClient.js";
import { parseInsight } from "./insight.js";

export const workoutSuggestionsRouter = Router();

interface SuggestionPayload {
  suggestions: {
    programExerciseId: string;
    exerciseName: string;
    action: "increase_weight" | "increase_reps" | "deload" | "swap" | "keep";
    reasoning: string;
    newTargetWeight?: number;
    newTargetRepsMin?: number;
    newTargetRepsMax?: number;
  }[];
}

workoutSuggestionsRouter.get("/", async (req: AuthedRequest, res) => {
  const insights = await prisma.aiInsight.findMany({
    where: { userId: req.userId, type: "workout_suggestion" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  res.json(insights.map((i) => parseInsight<SuggestionPayload>(i)));
});

workoutSuggestionsRouter.post("/generate", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const [context, activePrograms] = await Promise.all([
    buildUserContext(userId),
    prisma.workoutProgram.findMany({
      where: { userId, isActive: true },
      include: { days: { include: { exercises: { include: { exercise: true } } } } },
    }),
  ]);

  if (activePrograms.length === 0) {
    return res.status(400).json({ error: "Geen actief trainingsprogramma om te analyseren." });
  }

  const programLines: string[] = ["## Huidig actief programma (met programExerciseId)"];
  for (const program of activePrograms) {
    programLines.push(`Programma: ${program.name}`);
    for (const day of program.days) {
      programLines.push(`  Dag: ${day.name}`);
      for (const pe of day.exercises) {
        programLines.push(
          `    [${pe.id}] ${pe.exercise.name}: ${pe.targetSets}x${pe.targetRepsMin}-${pe.targetRepsMax} @ ${pe.targetWeight ?? "?"}kg${pe.targetRpe ? ` RPE${pe.targetRpe}` : ""}`
        );
      }
    }
  }

  const fullContext = `${context}\n\n${programLines.join("\n")}`;

  try {
    const result = await callClaudeJson<SuggestionPayload>({
      system:
        "Je bent een ervaren krachttrainingscoach. Analyseer de trainingsgeschiedenis en het huidige programma en stel per oefening een concrete aanpassing voor (verzwaren, deload, reps ophogen, oefening vervangen, of gelijk houden) inclusief korte onderbouwing. Gebruik ALTIJD de exacte programExerciseId zoals aangegeven tussen [blokhaken] in het programma.",
      messages: [
        {
          role: "user",
          content: `${fullContext}\n\nGeef aanpassingsvoorstellen voor dit programma.`,
        },
      ],
      toolName: "submit_workout_suggestions",
      toolDescription: "Structured programma-aanpassingsvoorstellen",
      inputSchema: {
        type: "object",
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                programExerciseId: { type: "string" },
                exerciseName: { type: "string" },
                action: {
                  type: "string",
                  enum: ["increase_weight", "increase_reps", "deload", "swap", "keep"],
                },
                reasoning: { type: "string" },
                newTargetWeight: { type: "number" },
                newTargetRepsMin: { type: "number" },
                newTargetRepsMax: { type: "number" },
              },
              required: ["programExerciseId", "exerciseName", "action", "reasoning"],
            },
          },
        },
        required: ["suggestions"],
      },
    });

    const insight = await prisma.aiInsight.create({
      data: { userId, type: "workout_suggestion", content: JSON.stringify(result) },
    });
    res.status(201).json({ ...insight, content: result });
  } catch (err) {
    console.error("Workout suggestion generation failed", err);
    res.status(502).json({ error: (err as Error).message });
  }
});

workoutSuggestionsRouter.post("/:id/accept", async (req: AuthedRequest, res) => {
  const insight = await prisma.aiInsight.findFirst({
    where: { id: req.params.id, userId: req.userId, type: "workout_suggestion" },
  });
  if (!insight) return res.status(404).json({ error: "Not found" });

  const content = JSON.parse(insight.content) as SuggestionPayload;
  for (const s of content.suggestions) {
    if (s.newTargetWeight == null && s.newTargetRepsMin == null && s.newTargetRepsMax == null) continue;
    await prisma.programExercise.updateMany({
      where: { id: s.programExerciseId, programDay: { program: { userId: req.userId } } },
      data: {
        ...(s.newTargetWeight != null ? { targetWeight: s.newTargetWeight } : {}),
        ...(s.newTargetRepsMin != null ? { targetRepsMin: s.newTargetRepsMin } : {}),
        ...(s.newTargetRepsMax != null ? { targetRepsMax: s.newTargetRepsMax } : {}),
      },
    });
  }
  await prisma.aiInsight.update({ where: { id: insight.id }, data: { status: "accepted" } });
  res.json({ ok: true });
});

workoutSuggestionsRouter.post("/:id/dismiss", async (req: AuthedRequest, res) => {
  await prisma.aiInsight.updateMany({
    where: { id: req.params.id, userId: req.userId },
    data: { status: "dismissed" },
  });
  res.json({ ok: true });
});
