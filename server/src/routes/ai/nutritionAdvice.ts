import { Router } from "express";
import { prisma } from "../../db.js";
import type { AuthedRequest } from "../../auth/middleware.js";
import { buildUserContext } from "./contextBuilder.js";
import { callClaude } from "./claudeClient.js";
import { parseInsight } from "./insight.js";

export const nutritionAdviceRouter = Router();

nutritionAdviceRouter.get("/latest", async (req: AuthedRequest, res) => {
  const latest = await prisma.aiInsight.findFirst({
    where: { userId: req.userId, type: "nutrition_advice" },
    orderBy: { createdAt: "desc" },
  });
  const isToday = latest && new Date(latest.createdAt).toDateString() === new Date().toDateString();
  res.json(isToday ? parseInsight<{ text: string }>(latest) : null);
});

nutritionAdviceRouter.post("/generate", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);

  const [context, goal, todayEntries] = await Promise.all([
    buildUserContext(userId),
    prisma.nutritionGoal.findFirst({
      where: { userId, effectiveFrom: { lte: today } },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.foodLogEntry.findMany({
      where: { userId, date: { gte: start, lte: end } },
      include: { foodItem: true },
    }),
  ]);

  const totals = todayEntries.reduce(
    (acc, e) => {
      const f = e.quantityGrams / 100;
      acc.cal += e.foodItem.caloriesPer100g * f;
      acc.protein += e.foodItem.proteinPer100g * f;
      acc.carbs += e.foodItem.carbsPer100g * f;
      acc.fat += e.foodItem.fatPer100g * f;
      return acc;
    },
    { cal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const todaySummary = goal
    ? `Vandaag tot nu toe gegeten: ${Math.round(totals.cal)}/${goal.calories} kcal, eiwit ${Math.round(totals.protein)}/${goal.proteinGrams}g, koolh. ${Math.round(totals.carbs)}/${goal.carbsGrams}g, vet ${Math.round(totals.fat)}/${goal.fatGrams}g.`
    : `Vandaag tot nu toe gegeten: ${Math.round(totals.cal)} kcal, eiwit ${Math.round(totals.protein)}g. Er is geen voedingsdoel ingesteld.`;

  try {
    const advice = await callClaude({
      system:
        "Je bent een sportvoedingscoach. Geef in maximaal 4 zinnen concreet en praktisch advies voor de rest van de dag, gebaseerd op wat er al gegeten is versus het doel en of het een trainingsdag is. Antwoord in het Nederlands, geen inleidende zinnen.",
      messages: [{ role: "user", content: `${context}\n\n${todaySummary}\n\nGeef advies voor de rest van vandaag.` }],
      maxTokens: 400,
    });

    const content = { text: advice, totals };
    const insight = await prisma.aiInsight.create({
      data: { userId, type: "nutrition_advice", content: JSON.stringify(content) },
    });
    res.status(201).json({ ...insight, content });
  } catch (err) {
    console.error("Nutrition advice generation failed", err);
    res.status(502).json({ error: (err as Error).message });
  }
});
