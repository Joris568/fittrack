import { Router } from "express";
import { z } from "zod";
import { callClaudeJson } from "./claudeClient.js";
import { searchOpenFoodFacts } from "../food.js";

export const mealPhotoRouter = Router();

interface VisionMeal {
  dishName: string;
  items: {
    name: string;
    searchQuery: string;
    estimatedGrams: number;
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
  }[];
  notes?: string;
}

const analyzeSchema = z.object({ imageData: z.string().startsWith("data:image/") });

/** Picks the Open Food Facts result whose calories are plausible for the food Claude
 * saw. Open Food Facts is branded packaged products, so the first hit for e.g. "gekookte
 * rijst" can be a weird product — only trust a hit within ~35% of the estimate. */
function pickPlausible<T extends { caloriesPer100g: number }>(results: T[], estimateKcal: number): T | null {
  const tolerance = Math.max(30, estimateKcal * 0.35);
  const candidates = results.filter((r) => Math.abs(r.caloriesPer100g - estimateKcal) <= tolerance);
  return candidates[0] ?? null;
}

mealPhotoRouter.post("/analyze", async (req, res) => {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Geen geldige foto meegestuurd." });

  try {
    const meal = await callClaudeJson<VisionMeal>({
      system:
        "Je bent een voedingsdeskundige die een foto van een maaltijd analyseert. Splits het gerecht op in losse, zoekbare voedingsmiddelen (bijv. 'gekookte rijst', 'kipfilet gebakken', 'broccoli gekookt') in plaats van het hele gerecht als één item. Schat per onderdeel het gewicht in gram zoals het op het bord ligt (gebruik bord-/portiegrootte als referentie), en geef realistische voedingswaarden per 100g. Houd rekening met zichtbaar vet of saus als aparte items (bijv. olijfolie, dressing) als dat duidelijk te zien is. Wees eerlijk als iets onduidelijk is: noem het dan in 'notes'. Staat er geen eten op de foto, geef dan een lege items-lijst.",
      messages: [{ role: "user", content: "Analyseer deze maaltijd." }],
      imageDataUrls: [parsed.data.imageData],
      toolName: "submit_meal_analysis",
      toolDescription: "Structured breakdown of the meal in the photo",
      inputSchema: {
        type: "object",
        properties: {
          dishName: { type: "string", description: "Korte naam van het gerecht" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Leesbare naam in het Nederlands" },
                searchQuery: { type: "string", description: "Korte Nederlandse zoekterm voor een voedingsdatabase, zonder merk" },
                estimatedGrams: { type: "number", description: "Geschat gewicht in gram op het bord" },
                caloriesPer100g: { type: "number" },
                proteinPer100g: { type: "number" },
                carbsPer100g: { type: "number" },
                fatPer100g: { type: "number" },
              },
              required: ["name", "searchQuery", "estimatedGrams", "caloriesPer100g", "proteinPer100g", "carbsPer100g", "fatPer100g"],
            },
          },
          notes: { type: "string", description: "Korte opmerking over onzekerheid, indien van toepassing" },
        },
        required: ["dishName", "items"],
      },
      maxTokens: 1500,
    });

    // Look up every item in Open Food Facts in parallel; a failed/slow lookup just
    // falls back to Claude's own estimate for that item.
    const items = await Promise.all(
      meal.items.map(async (item) => {
        const estimate = {
          source: "estimate" as const,
          barcode: null,
          name: item.name,
          brand: null,
          caloriesPer100g: item.caloriesPer100g,
          proteinPer100g: item.proteinPer100g,
          carbsPer100g: item.carbsPer100g,
          fatPer100g: item.fatPer100g,
          fiberPer100g: null,
        };
        try {
          const results = await searchOpenFoodFacts(item.searchQuery, 10, 8_000);
          const match = pickPlausible(results, item.caloriesPer100g);
          if (match) return { name: item.name, estimatedGrams: Math.round(item.estimatedGrams), source: "openfoodfacts" as const, food: match };
        } catch (err) {
          console.error("Meal photo: Open Food Facts lookup failed for", item.searchQuery, err);
        }
        return { name: item.name, estimatedGrams: Math.round(item.estimatedGrams), source: "estimate" as const, food: estimate };
      })
    );

    res.json({ dishName: meal.dishName, notes: meal.notes ?? null, items });
  } catch (err) {
    console.error("Meal photo analysis failed", err);
    res.status(502).json({ error: (err as Error).message });
  }
});
