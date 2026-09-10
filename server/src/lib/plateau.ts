import { prisma } from "../db.js";

export interface PlateauResult {
  programExerciseId: string;
  exerciseName: string;
  sessionsFlat: number;
  weights: number[];
}

/** Deterministic (no AI call, no cost) plateau check: an exercise "plateaus" when
 * its top-set weight hasn't increased over its last 3 logged sessions. Cheap
 * enough to run on every page load, unlike the AI workout-suggestion analysis. */
export async function detectPlateaus(userId: string): Promise<PlateauResult[]> {
  const activePrograms = await prisma.workoutProgram.findMany({
    where: { userId, isActive: true },
    include: { days: { include: { exercises: { include: { exercise: true } } } } },
  });

  const results: PlateauResult[] = [];

  for (const program of activePrograms) {
    for (const day of program.days) {
      for (const pe of day.exercises) {
        const sets = await prisma.setLog.findMany({
          where: { exerciseId: pe.exerciseId, workoutSession: { userId } },
          orderBy: { createdAt: "desc" },
          take: 60,
          include: { workoutSession: true },
        });
        if (sets.length === 0) continue;

        const bySession = new Map<string, { date: Date; maxWeight: number }>();
        for (const s of sets) {
          const existing = bySession.get(s.workoutSessionId);
          const maxWeight = existing ? Math.max(existing.maxWeight, s.weight) : s.weight;
          bySession.set(s.workoutSessionId, { date: s.workoutSession.date, maxWeight });
        }

        const lastThree = [...bySession.values()]
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, 3);

        if (lastThree.length < 3) continue;

        const weights = lastThree.map((s) => s.maxWeight);
        const mostRecentTwo = Math.max(weights[0], weights[1]);
        if (mostRecentTwo <= weights[2]) {
          results.push({
            programExerciseId: pe.id,
            exerciseName: pe.exercise.name,
            sessionsFlat: lastThree.length,
            weights: weights.reverse(),
          });
        }
      }
    }
  }

  return results;
}
