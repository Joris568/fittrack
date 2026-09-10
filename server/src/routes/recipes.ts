import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../auth/middleware.js";

export const recipesRouter = Router();

recipesRouter.get("/", async (req: AuthedRequest, res) => {
  const recipes = await prisma.recipe.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
  });
  res.json(recipes.map((r) => ({ ...r, ingredients: JSON.parse(r.ingredients) })));
});

const saveSchema = z.object({
  name: z.string().min(1),
  sourceText: z.string(),
  servings: z.number().int().min(1),
  caloriesPerServing: z.number().min(0),
  proteinPerServing: z.number().min(0),
  carbsPerServing: z.number().min(0),
  fatPerServing: z.number().min(0),
  ingredients: z.array(
    z.object({ name: z.string(), quantity: z.string(), estimatedCalories: z.number() })
  ),
});

recipesRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // A "portion" is represented as 100g of a virtual FoodItem so a recipe plugs
  // straight into the existing gram-based food-logging flow without schema changes there.
  const foodItem = await prisma.foodItem.create({
    data: {
      source: "recipe",
      name: parsed.data.name,
      caloriesPer100g: parsed.data.caloriesPerServing,
      proteinPer100g: parsed.data.proteinPerServing,
      carbsPer100g: parsed.data.carbsPerServing,
      fatPer100g: parsed.data.fatPerServing,
    },
  });

  const recipe = await prisma.recipe.create({
    data: {
      userId: req.userId!,
      name: parsed.data.name,
      sourceText: parsed.data.sourceText,
      servings: parsed.data.servings,
      caloriesPerServing: parsed.data.caloriesPerServing,
      proteinPerServing: parsed.data.proteinPerServing,
      carbsPerServing: parsed.data.carbsPerServing,
      fatPerServing: parsed.data.fatPerServing,
      ingredients: JSON.stringify(parsed.data.ingredients),
      foodItemId: foodItem.id,
    },
  });
  res.status(201).json({ ...recipe, ingredients: parsed.data.ingredients });
});

recipesRouter.delete("/:id", async (req: AuthedRequest, res) => {
  await prisma.recipe.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  res.json({ ok: true });
});
