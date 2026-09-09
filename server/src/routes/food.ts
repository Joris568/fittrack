import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../auth/middleware.js";
import { checkAndUnlockAchievements } from "../gamification/achievements.js";

export const foodRouter = Router();

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, number>;
}

foodRouter.get("/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) return res.json([]);
  try {
    const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    url.searchParams.set("search_terms", q);
    url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", "20");
    url.searchParams.set(
      "fields",
      "code,product_name,brands,nutriments"
    );
    const response = await fetch(url, {
      headers: { "User-Agent": "FitTrack-PersonalApp/1.0" },
    });
    const data = (await response.json()) as { products?: OffProduct[] };
    const results = (data.products ?? [])
      .filter((p) => p.product_name && p.nutriments?.["energy-kcal_100g"] != null)
      .map((p) => ({
        barcode: p.code ?? null,
        name: p.product_name!,
        brand: p.brands ?? null,
        caloriesPer100g: p.nutriments!["energy-kcal_100g"] ?? 0,
        proteinPer100g: p.nutriments!["proteins_100g"] ?? 0,
        carbsPer100g: p.nutriments!["carbohydrates_100g"] ?? 0,
        fatPer100g: p.nutriments!["fat_100g"] ?? 0,
        fiberPer100g: p.nutriments!["fiber_100g"] ?? null,
      }));
    res.json(results);
  } catch (err) {
    console.error("OpenFoodFacts search failed", err);
    res.status(502).json({ error: "Voedseldatabase niet bereikbaar" });
  }
});

const customFoodSchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  caloriesPer100g: z.number().min(0),
  proteinPer100g: z.number().min(0),
  carbsPer100g: z.number().min(0),
  fatPer100g: z.number().min(0),
  fiberPer100g: z.number().min(0).optional(),
});

foodRouter.post("/custom", async (req, res) => {
  const parsed = customFoodSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.foodItem.create({
    data: { source: "custom", ...parsed.data },
  });
  res.status(201).json(item);
});

const logEntrySchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  quantityGrams: z.number().min(0),
  date: z.string().datetime().optional(),
  foodItemId: z.string().optional(),
  foodItem: z
    .object({
      barcode: z.string().nullable().optional(),
      name: z.string(),
      brand: z.string().nullable().optional(),
      caloriesPer100g: z.number(),
      proteinPer100g: z.number(),
      carbsPer100g: z.number(),
      fatPer100g: z.number(),
      fiberPer100g: z.number().nullable().optional(),
    })
    .optional(),
});

foodRouter.post("/log", async (req: AuthedRequest, res) => {
  const parsed = logEntrySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { foodItemId, foodItem, mealType, quantityGrams, date } = parsed.data;

  let resolvedFoodItemId = foodItemId;
  if (!resolvedFoodItemId && foodItem) {
    if (foodItem.barcode) {
      const item = await prisma.foodItem.upsert({
        where: { barcode: foodItem.barcode },
        update: {},
        create: { source: "openfoodfacts", ...foodItem, barcode: foodItem.barcode },
      });
      resolvedFoodItemId = item.id;
    } else {
      const item = await prisma.foodItem.create({
        data: { source: "openfoodfacts", ...foodItem },
      });
      resolvedFoodItemId = item.id;
    }
  }
  if (!resolvedFoodItemId) return res.status(400).json({ error: "foodItemId of foodItem vereist" });

  const entry = await prisma.foodLogEntry.create({
    data: {
      userId: req.userId!,
      foodItemId: resolvedFoodItemId,
      mealType,
      quantityGrams,
      date: date ? new Date(date) : undefined,
    },
    include: { foodItem: true },
  });
  const newAchievements = await checkAndUnlockAchievements(req.userId!);
  res.status(201).json({ ...entry, newAchievements });
});

foodRouter.get("/log", async (req: AuthedRequest, res) => {
  const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;
  const day = dateParam ? new Date(dateParam) : new Date();
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);

  const entries = await prisma.foodLogEntry.findMany({
    where: { userId: req.userId, date: { gte: start, lte: end } },
    include: { foodItem: true },
    orderBy: { date: "asc" },
  });
  res.json(entries);
});

foodRouter.delete("/log/:id", async (req: AuthedRequest, res) => {
  await prisma.foodLogEntry.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  res.json({ ok: true });
});
