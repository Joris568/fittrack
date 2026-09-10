import { Router } from "express";
import { prisma } from "../../db.js";
import type { AuthedRequest } from "../../auth/middleware.js";
import { buildUserContext } from "./contextBuilder.js";
import { callClaudeJson } from "./claudeClient.js";
import { parseInsight } from "./insight.js";
import { TRAINING_KNOWLEDGE_BASE } from "./knowledgeBase.js";

export const goalProposalRouter = Router();

interface GoalProposalPayload {
  challenge: string;
  reasoning: string;
  proposedGoal: {
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  };
}

goalProposalRouter.get("/", async (req: AuthedRequest, res) => {
  const insights = await prisma.aiInsight.findMany({
    where: { userId: req.userId, type: "goal_proposal" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  res.json(insights.map((i) => parseInsight<GoalProposalPayload>(i)));
});

goalProposalRouter.post("/generate", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const context = await buildUserContext(userId);

  try {
    const result = await callClaudeJson<GoalProposalPayload>({
      system: `Je bent een directe, evidence-based coach die de gebruiker blijft pushen in plaats van alleen data terug te lezen. Kijk kritisch naar de voortgang van de afgelopen weken (consistentie, volume, voeding, gewichtstrend) en:
1. Formuleer één scherpe, persoonlijke uitdagende vraag of observatie ("challenge") die de gebruiker aan het denken zet over waar hij achterblijft of wat beter kan.
2. Onderbouw kort waarom (2-3 zinnen, met concrete cijfers uit de data).
3. Stel een concreet, aangescherpt volgend voedingsdoel voor (calorieën/eiwit/koolhydraten/vet) dat logisch aansluit op zijn doel en voortgang.

${TRAINING_KNOWLEDGE_BASE}`,
      messages: [
        {
          role: "user",
          content: `${context}\n\nGeef je challenge en een aangescherpt voedingsdoel.`,
        },
      ],
      toolName: "submit_goal_proposal",
      toolDescription: "Structured coaching challenge with a proposed nutrition goal",
      inputSchema: {
        type: "object",
        properties: {
          challenge: { type: "string", description: "Eén scherpe, persoonlijke uitdagende vraag of observatie" },
          reasoning: { type: "string", description: "Korte onderbouwing met concrete cijfers" },
          proposedGoal: {
            type: "object",
            properties: {
              calories: { type: "number" },
              proteinGrams: { type: "number" },
              carbsGrams: { type: "number" },
              fatGrams: { type: "number" },
            },
            required: ["calories", "proteinGrams", "carbsGrams", "fatGrams"],
          },
        },
        required: ["challenge", "reasoning", "proposedGoal"],
      },
      maxTokens: 1000,
    });

    const insight = await prisma.aiInsight.create({
      data: { userId, type: "goal_proposal", content: JSON.stringify(result) },
    });
    res.status(201).json({ ...insight, content: result });
  } catch (err) {
    console.error("Goal proposal generation failed", err);
    res.status(502).json({ error: (err as Error).message });
  }
});

goalProposalRouter.post("/:id/accept", async (req: AuthedRequest, res) => {
  const insight = await prisma.aiInsight.findFirst({
    where: { id: req.params.id, userId: req.userId, type: "goal_proposal" },
  });
  if (!insight) return res.status(404).json({ error: "Not found" });

  const content = JSON.parse(insight.content) as GoalProposalPayload;
  await prisma.nutritionGoal.create({
    data: { userId: req.userId!, ...content.proposedGoal },
  });
  await prisma.aiInsight.update({ where: { id: insight.id }, data: { status: "accepted" } });
  res.json({ ok: true });
});

goalProposalRouter.post("/:id/dismiss", async (req: AuthedRequest, res) => {
  await prisma.aiInsight.updateMany({
    where: { id: req.params.id, userId: req.userId },
    data: { status: "dismissed" },
  });
  res.json({ ok: true });
});
