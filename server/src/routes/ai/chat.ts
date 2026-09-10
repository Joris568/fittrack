import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";
import type { AuthedRequest } from "../../auth/middleware.js";
import { buildUserContext } from "./contextBuilder.js";
import { callClaude } from "./claudeClient.js";
import { TRAINING_KNOWLEDGE_BASE } from "./knowledgeBase.js";

export const chatRouter = Router();

const COACH_SYSTEM_PROMPT = `Je bent een ervaren, evidence-based kracht- en voedingscoach die de persoonlijke trainings- en voedingsdata van de gebruiker tot in detail kent.
Je bent geen passieve assistent die alleen antwoord geeft als erom gevraagd wordt — je bent een coach die blijft pushen. Dat betekent:
- Als de data een patroon laat zien (gemiste trainingen, stagnerend gewicht, te weinig eiwit, dalend volume), benoem dat ongevraagd en direct, ook als de vraag daar niet over ging.
- Stel tegenvragen als iets vaags of te makkelijk klinkt ("wat bedoel je precies met 'best goed'?", "hoeveel was dat dan echt?").
- Sluit relevante antwoorden af met één scherpe, concrete vervolgvraag of een kleine uitdaging voor de komende dagen — geen slappe motivatieteksten, wel iets meetbaars.
- Wees eerlijk als iets niet goed gaat; complimenteus alleen als het verdiend is met de cijfers.
Geef concrete, onderbouwde adviezen op basis van de data hieronder. Wees direct en praktisch, geen wollige taal.
Onderbouw waar relevant met de kennisbasis (volume-ranges, eiwitrichtlijnen, surplus/tekort-snelheden) en reken door met de eigen cijfers van de gebruiker in plaats van vage algemeenheden te geven.
Antwoord in het Nederlands, gebruik korte alinea's of bullet points waar dat helpt.

${TRAINING_KNOWLEDGE_BASE}

DATA VAN DE GEBRUIKER:
`;

const CHECKIN_SYSTEM_PROMPT = `Je bent een directe, evidence-based coach. Dit is het begin van een nieuw gesprek — de gebruiker heeft nog niets getypt. Open zelf met een korte, persoonlijke check-in gebaseerd op de data: benoem in 1-2 zinnen wat opvalt (goed of slecht) en sluit af met één scherpe, concrete vraag die uitdaagt. Geen begroeting, geen inleiding, geen lijstjes — gewoon direct to the point, max 3 zinnen totaal. Antwoord in het Nederlands.

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

/** Lazily generates a proactive opening message once per day, so the coach starts
 * the conversation instead of only ever reacting to the user's first message. */
chatRouter.post("/checkin", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const lastMessage = await prisma.chatMessage.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const isToday = lastMessage && new Date(lastMessage.createdAt).toDateString() === new Date().toDateString();
  if (isToday) return res.json(null);

  try {
    const context = await buildUserContext(userId);
    const reply = await callClaude({
      system: CHECKIN_SYSTEM_PROMPT + context,
      messages: [{ role: "user", content: "Open het gesprek." }],
      maxTokens: 300,
    });
    const message = await prisma.chatMessage.create({ data: { userId, role: "assistant", content: reply } });
    res.json(message);
  } catch (err) {
    console.error("Coach check-in failed", err);
    res.json(null);
  }
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
