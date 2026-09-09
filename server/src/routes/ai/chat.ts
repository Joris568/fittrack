import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";
import type { AuthedRequest } from "../../auth/middleware.js";
import { buildUserContext } from "./contextBuilder.js";
import { callClaude } from "./claudeClient.js";
import { TRAINING_KNOWLEDGE_BASE } from "./knowledgeBase.js";

export const chatRouter = Router();

const COACH_SYSTEM_PROMPT = `Je bent een ervaren, evidence-based kracht- en voedingscoach die de persoonlijke trainings- en voedingsdata van de gebruiker tot in detail kent.
Geef concrete, onderbouwde adviezen op basis van de data hieronder. Wees direct en praktisch, geen wollige taal.
Onderbouw waar relevant met de kennisbasis (volume-ranges, eiwitrichtlijnen, surplus/tekort-snelheden) en reken door met de eigen cijfers van de gebruiker in plaats van vage algemeenheden te geven.
Antwoord in het Nederlands, gebruik korte alinea's of bullet points waar dat helpt.

${TRAINING_KNOWLEDGE_BASE}

DATA VAN DE GEBRUIKER:
`;

chatRouter.get("/", async (req: AuthedRequest, res) => {
  const messages = await prisma.chatMessage.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  res.json(messages);
});

const chatSchema = z.object({ message: z.string().min(1) });

chatRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.userId!;
  const [context, history] = await Promise.all([
    buildUserContext(userId),
    prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const orderedHistory = history.reverse();

  await prisma.chatMessage.create({ data: { userId, role: "user", content: parsed.data.message } });

  try {
    const reply = await callClaude({
      system: COACH_SYSTEM_PROMPT + context,
      messages: [
        ...orderedHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: parsed.data.message },
      ],
      maxTokens: 1024,
    });

    await prisma.chatMessage.create({ data: { userId, role: "assistant", content: reply } });
    res.json({ reply });
  } catch (err) {
    console.error("Chat AI call failed", err);
    res.status(502).json({ error: (err as Error).message });
  }
});
