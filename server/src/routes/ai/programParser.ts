import { Router } from "express";
import { z } from "zod";
import { callClaudeJson } from "./claudeClient.js";

export const programParserRouter = Router();

interface ParsedProgram {
  programName: string;
  days: {
    name: string;
    exercises: {
      exerciseName: string;
      targetSets: number;
      targetRepsMin: number;
      targetRepsMax: number;
      targetWeight?: number;
    }[];
  }[];
}

const parseSchema = z.object({ text: z.string().min(1) });

programParserRouter.post("/parse", async (req, res) => {
  const parsed = parseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const result = await callClaudeJson<ParsedProgram>({
      system:
        "Je bent een krachttrainingscoach. De gebruiker plakt een trainingsschema in willekeurige vorm (tekst, lijst, tabel-achtig). Herken de trainingsdagen en per dag de oefeningen met sets/reps/gewicht. Gebruik standaard Nederlandse of Engelse oefeningnamen zoals ze gangbaar zijn in een sportschool (bv. 'Bankdrukken', 'Squat', 'Lat pulldown'). Als sets/reps niet genoemd worden, gebruik een redelijke standaard (3 sets, 8-12 reps). Als gewicht niet genoemd wordt, laat het weg.",
      messages: [{ role: "user", content: `Schema:\n${parsed.data.text}\n\nAnalyseer dit trainingsschema.` }],
      toolName: "submit_program_analysis",
      toolDescription: "Structured workout program breakdown",
      inputSchema: {
        type: "object",
        properties: {
          programName: { type: "string", description: "Korte naam voor het programma" },
          days: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Naam van de trainingsdag, bv. 'Push Day A'" },
                exercises: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      exerciseName: { type: "string" },
                      targetSets: { type: "number" },
                      targetRepsMin: { type: "number" },
                      targetRepsMax: { type: "number" },
                      targetWeight: { type: "number", description: "Startgewicht in kg, alleen als genoemd" },
                    },
                    required: ["exerciseName", "targetSets", "targetRepsMin", "targetRepsMax"],
                  },
                },
              },
              required: ["name", "exercises"],
            },
          },
        },
        required: ["programName", "days"],
      },
      maxTokens: 2500,
    });
    res.json(result);
  } catch (err) {
    console.error("Program parsing failed", err);
    res.status(502).json({ error: (err as Error).message });
  }
});
