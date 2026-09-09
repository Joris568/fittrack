import { Router } from "express";
import type { AuthedRequest } from "../auth/middleware.js";
import { getGamificationSummary } from "../gamification/achievements.js";

export const gamificationRouter = Router();

gamificationRouter.get("/summary", async (req: AuthedRequest, res) => {
  res.json(await getGamificationSummary(req.userId!));
});
