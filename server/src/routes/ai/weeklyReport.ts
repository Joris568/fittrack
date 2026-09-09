import { Router } from "express";
import { prisma } from "../../db.js";
import type { AuthedRequest } from "../../auth/middleware.js";
import { buildUserContext } from "./contextBuilder.js";
import { callClaudeJson } from "./claudeClient.js";
import { parseInsight } from "./insight.js";

export const weeklyReportRouter = Router();

interface WeeklyReportPayload {
  summary: string;
  wins: string[];
  concerns: string[];
  recommendations: string[];
}

async function generateReport(userId: string) {
  const context = await buildUserContext(userId);
  const result = await callClaudeJson<WeeklyReportPayload>({
    system:
      "Je bent een kracht- en voedingscoach die elke week een kort voortgangsrapport schrijft op basis van de data van de gebruiker. Wees eerlijk en specifiek, gebruik concrete cijfers uit de data waar mogelijk. Antwoord in het Nederlands.",
    messages: [
      {
        role: "user",
        content: `${context}\n\nSchrijf het wekelijkse voortgangsrapport over de afgelopen 7 dagen.`,
      },
    ],
    toolName: "submit_weekly_report",
    toolDescription: "Structured weekly progress report",
    inputSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Korte samenvatting van de week (2-3 zinnen)" },
        wins: { type: "array", items: { type: "string" }, description: "Wat ging goed" },
        concerns: { type: "array", items: { type: "string" }, description: "Aandachtspunten" },
        recommendations: { type: "array", items: { type: "string" }, description: "Concrete aanbevelingen voor komende week" },
      },
      required: ["summary", "wins", "concerns", "recommendations"],
    },
    maxTokens: 1200,
  });

  const insight = await prisma.aiInsight.create({
    data: { userId, type: "weekly_report", content: JSON.stringify(result) },
  });
  return { ...insight, content: result };
}

weeklyReportRouter.get("/latest", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const latest = await prisma.aiInsight.findFirst({
    where: { userId, type: "weekly_report" },
    orderBy: { createdAt: "desc" },
  });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  if (latest && new Date(latest.createdAt) > sevenDaysAgo) {
    return res.json(parseInsight<WeeklyReportPayload>(latest));
  }

  try {
    const report = await generateReport(userId);
    res.json(report);
  } catch (err) {
    console.error("Weekly report generation failed", err);
    // Fall back to the last available report rather than failing the dashboard load.
    if (latest) return res.json(parseInsight<WeeklyReportPayload>(latest));
    res.status(502).json({ error: (err as Error).message });
  }
});

weeklyReportRouter.post("/generate", async (req: AuthedRequest, res) => {
  try {
    const report = await generateReport(req.userId!);
    res.status(201).json(report);
  } catch (err) {
    console.error("Weekly report generation failed", err);
    res.status(502).json({ error: (err as Error).message });
  }
});
