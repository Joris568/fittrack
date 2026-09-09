import "express-async-errors";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./env.js";
import { authRouter } from "./auth/routes.js";
import { requireAuth } from "./auth/middleware.js";
import { exercisesRouter } from "./routes/exercises.js";
import { programsRouter } from "./routes/programs.js";
import { workoutsRouter } from "./routes/workouts.js";
import { foodRouter } from "./routes/food.js";
import { goalsRouter } from "./routes/goals.js";
import { bodyMetricsRouter } from "./routes/bodyMetrics.js";
import { gamificationRouter } from "./routes/gamification.js";
import { chatRouter } from "./routes/ai/chat.js";
import { workoutSuggestionsRouter } from "./routes/ai/workoutSuggestions.js";
import { nutritionAdviceRouter } from "./routes/ai/nutritionAdvice.js";
import { weeklyReportRouter } from "./routes/ai/weeklyReport.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);

app.use("/api/exercises", requireAuth, exercisesRouter);
app.use("/api/programs", requireAuth, programsRouter);
app.use("/api/workouts", requireAuth, workoutsRouter);
app.use("/api/food", requireAuth, foodRouter);
app.use("/api/goals", requireAuth, goalsRouter);
app.use("/api/body-metrics", requireAuth, bodyMetricsRouter);
app.use("/api/gamification", requireAuth, gamificationRouter);
app.use("/api/ai/chat", requireAuth, chatRouter);
app.use("/api/ai/workout-suggestions", requireAuth, workoutSuggestionsRouter);
app.use("/api/ai/nutrition-advice", requireAuth, nutritionAdviceRouter);
app.use("/api/ai/weekly-report", requireAuth, weeklyReportRouter);

// Serve the built client in production.
const clientDist = path.join(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(clientDist, "index.html"));
});

// Catches errors thrown (or rejected) anywhere in a route — without this, an
// unhandled async error would crash the whole process instead of just failing one request.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled request error:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Er ging iets mis op de server." });
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

app.listen(env.port, () => {
  console.log(`FitTrack server draait op http://localhost:${env.port}`);
});
