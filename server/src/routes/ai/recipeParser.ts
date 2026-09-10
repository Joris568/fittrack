import { Router } from "express";
import { z } from "zod";
import { callClaudeJson } from "./claudeClient.js";

export const recipeParserRouter = Router();

interface ParsedRecipe {
  name: string;
  servings: number;
  ingredients: { name: string; quantity: string; estimatedCalories: number }[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

const parseSchema = z.object({
  text: z.string().min(1),
  servings: z.number().int().min(1).optional(),
});

recipeParserRouter.post("/parse", async (req, res) => {
  const parsed = parseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const result = await callClaudeJson<ParsedRecipe>({
      system:
        "Je bent een voedingsdeskundige. De gebruiker plakt een recept (ingrediënten en/of bereidingswijze, in willekeurige vorm). Herken de ingrediënten met hoeveelheden, schat per ingrediënt en in totaal de voedingswaarden in op basis van je kennis van voedingsmiddelen. Wees realistisch en gebruik gangbare porties/dichtheden als exacte hoeveelheden ontbreken.",
      messages: [
        {
          role: "user",
          content: `Recept:\n${parsed.data.text}\n\n${
            parsed.data.servings
              ? `Dit recept is voor ${parsed.data.servings} porties.`
              : "Schat zelf een realistisch aantal porties in."
          }\n\nAnalyseer dit recept.`,
        },
      ],
      toolName: "submit_recipe_analysis",
      toolDescription: "Structured recipe nutrition analysis",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Korte naam voor het gerecht" },
          servings: { type: "number", description: "Aantal porties" },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                quantity: { type: "string" },
                estimatedCalories: { type: "number", description: "Geschatte kcal voor deze hoeveelheid" },
              },
              required: ["name", "quantity", "estimatedCalories"],
            },
          },
          totalCalories: { type: "number", description: "Totaal kcal voor het hele recept (alle porties samen)" },
          totalProtein: { type: "number", description: "Totaal eiwit (g) voor het hele recept" },
          totalCarbs: { type: "number", description: "Totaal koolhydraten (g) voor het hele recept" },
          totalFat: { type: "number", description: "Totaal vet (g) voor het hele recept" },
        },
        required: ["name", "servings", "ingredients", "totalCalories", "totalProtein", "totalCarbs", "totalFat"],
      },
      maxTokens: 2000,
    });
    res.json(result);
  } catch (err) {
    console.error("Recipe parsing failed", err);
    res.status(502).json({ error: (err as Error).message });
  }
});
