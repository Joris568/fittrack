import { prisma } from "../../db.js";
import { makeExerciseResolver } from "../../lib/exerciseResolver.js";
import { checkAndUnlockAchievements } from "../../gamification/achievements.js";
import { analyzeImage, type AgentTool } from "./claudeClient.js";

interface ExerciseInput {
  exerciseName: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetWeight?: number;
}

const exerciseInputSchema = {
  type: "object",
  properties: {
    exerciseName: { type: "string" },
    targetSets: { type: "number" },
    targetRepsMin: { type: "number" },
    targetRepsMax: { type: "number" },
    targetWeight: { type: "number", description: "In kg, alleen als bekend/besproken" },
  },
  required: ["exerciseName", "targetSets", "targetRepsMin", "targetRepsMax"],
};

/** The coach's real actions — every one is scoped to `userId` so the chat can
 * never touch another user's data (moot for this single-user app, but kept
 * consistent with the rest of the API). */
export function buildCoachTools(userId: string): AgentTool[] {
  return [
    {
      name: "list_programs",
      description:
        "Haal de huidige trainingsprogramma's van de gebruiker op (namen van programma's, dagen en oefeningen met targets). Roep dit ALTIJD aan voordat je een bestaand programma probeert te wijzigen, zodat je de exacte namen kent.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const programs = await prisma.workoutProgram.findMany({
          where: { userId },
          include: { days: { include: { exercises: { include: { exercise: true } } } } },
        });
        return programs.map((p) => ({
          name: p.name,
          isActive: p.isActive,
          days: p.days.map((d) => ({
            name: d.name,
            exercises: d.exercises.map((e) => ({
              exerciseName: e.exercise.name,
              targetSets: e.targetSets,
              targetRepsMin: e.targetRepsMin,
              targetRepsMax: e.targetRepsMax,
              targetWeight: e.targetWeight,
            })),
          })),
        }));
      },
    },
    {
      name: "create_program",
      description:
        "Maak een nieuw trainingsprogramma aan met dagen en oefeningen. Gebruik dit als de gebruiker vraagt om een nieuw schema, of om een bestaand schema volledig te vervangen (verwijder dan eerst het oude via delete_program als dat zo besproken is).",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          days: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                exercises: { type: "array", items: exerciseInputSchema },
              },
              required: ["name", "exercises"],
            },
          },
        },
        required: ["name", "days"],
      },
      execute: async (input: {
        name: string;
        days: { name: string; exercises: ExerciseInput[] }[];
      }) => {
        const resolveExercise = makeExerciseResolver();
        const program = await prisma.workoutProgram.create({ data: { userId, name: input.name } });
        for (const [dayIndex, day] of input.days.entries()) {
          const createdDay = await prisma.programDay.create({
            data: { programId: program.id, name: day.name, order: dayIndex },
          });
          for (const [exIndex, ex] of day.exercises.entries()) {
            const exercise = await resolveExercise(ex.exerciseName);
            await prisma.programExercise.create({
              data: {
                programDayId: createdDay.id,
                exerciseId: exercise.id,
                order: exIndex,
                targetSets: ex.targetSets,
                targetRepsMin: ex.targetRepsMin,
                targetRepsMax: ex.targetRepsMax,
                targetWeight: ex.targetWeight,
              },
            });
          }
        }
        await checkAndUnlockAchievements(userId);
        return { created: true, programId: program.id, name: program.name };
      },
    },
    {
      name: "add_exercise_to_program",
      description:
        "Voeg één oefening toe aan een dag binnen een bestaand programma. Als de dag niet bestaat, wordt hij aangemaakt. Gebruik list_programs eerst om de exacte programma- en dagnaam te weten.",
      inputSchema: {
        type: "object",
        properties: {
          programName: { type: "string" },
          dayName: { type: "string" },
          exercise: exerciseInputSchema,
        },
        required: ["programName", "dayName", "exercise"],
      },
      execute: async (input: { programName: string; dayName: string; exercise: ExerciseInput }) => {
        const program = await prisma.workoutProgram.findFirst({
          where: { userId, name: { equals: input.programName } },
          include: { days: true },
        });
        if (!program) {
          const allPrograms = await prisma.workoutProgram.findMany({ where: { userId } });
          const match = allPrograms.find((p) => p.name.toLowerCase() === input.programName.toLowerCase());
          if (!match) return { error: `Programma "${input.programName}" niet gevonden.` };
          return addExerciseToProgramDay(match.id, input.dayName, input.exercise);
        }
        return addExerciseToProgramDay(program.id, input.dayName, input.exercise);
      },
    },
    {
      name: "update_program_exercise",
      description:
        "Pas de targets (sets, reps, gewicht) aan van een bestaande oefening in een programma. Gebruik list_programs eerst om de exacte namen te weten. Alleen de meegegeven velden worden aangepast.",
      inputSchema: {
        type: "object",
        properties: {
          programName: { type: "string" },
          dayName: { type: "string" },
          exerciseName: { type: "string" },
          targetSets: { type: "number" },
          targetRepsMin: { type: "number" },
          targetRepsMax: { type: "number" },
          targetWeight: { type: "number" },
        },
        required: ["programName", "dayName", "exerciseName"],
      },
      execute: async (input: {
        programName: string;
        dayName: string;
        exerciseName: string;
        targetSets?: number;
        targetRepsMin?: number;
        targetRepsMax?: number;
        targetWeight?: number;
      }) => {
        const programExercise = await findProgramExercise(userId, input.programName, input.dayName, input.exerciseName);
        if (!programExercise) return { error: "Oefening niet gevonden in dat programma/die dag." };
        await prisma.programExercise.update({
          where: { id: programExercise.id },
          data: {
            ...(input.targetSets != null ? { targetSets: input.targetSets } : {}),
            ...(input.targetRepsMin != null ? { targetRepsMin: input.targetRepsMin } : {}),
            ...(input.targetRepsMax != null ? { targetRepsMax: input.targetRepsMax } : {}),
            ...(input.targetWeight != null ? { targetWeight: input.targetWeight } : {}),
          },
        });
        return { updated: true };
      },
    },
    {
      name: "remove_exercise_from_program",
      description: "Verwijder een oefening uit een programmadag.",
      inputSchema: {
        type: "object",
        properties: {
          programName: { type: "string" },
          dayName: { type: "string" },
          exerciseName: { type: "string" },
        },
        required: ["programName", "dayName", "exerciseName"],
      },
      execute: async (input: { programName: string; dayName: string; exerciseName: string }) => {
        const programExercise = await findProgramExercise(userId, input.programName, input.dayName, input.exerciseName);
        if (!programExercise) return { error: "Oefening niet gevonden in dat programma/die dag." };
        await prisma.programExercise.delete({ where: { id: programExercise.id } });
        return { removed: true };
      },
    },
    {
      name: "analyze_physique_photo",
      description:
        "Analyseer de meest recente voortgangsfoto van de gebruiker (indien geüpload bij Instellingen) op lichaamsbouw: schouderbreedte t.o.v. taille, torso-verhoudingen, welke spiergroepen relatief onder-/overontwikkeld ogen, en wat specifiek voor DEZE bouw de meeste 'brede V-taper'-impact zou geven. Gebruik dit als de gebruiker vraagt naar zijn/haar bouw, physique, hoe hij/zij eruitziet, of om een op het lichaam afgestemd (in plaats van generiek) trainings-/voedingsadvies. Combineer de uitkomst daarna met update_program_exercise / add_exercise_to_program / set_nutrition_goal om het advies ook echt door te voeren.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const photo = await prisma.progressPhoto.findFirst({
          where: { userId },
          orderBy: { date: "desc" },
        });
        if (!photo) {
          return { error: "Geen voortgangsfoto gevonden. Vraag de gebruiker er eentje te uploaden bij Instellingen." };
        }
        const analysis = await analyzeImage({
          imageDataUrl: photo.imageData,
          prompt: `Analyseer deze fysieke voortgangsfoto van een krachtsporter als een ervaren coach. Beschrijf kort en concreet:
1. Verhouding schouderbreedte t.o.v. taille/heupen (de basis van een V-taper).
2. Torso-lengte en algemene lichaamsbouw (bv. lange armen/torso beïnvloedt hoe oefeningen aanvoelen en welke spiergroepen visueel het meeste bijdragen aan breedte).
3. Welke spiergroepen relatief onder- of overontwikkeld ogen ten opzichte van de rest.
4. Concrete conclusie: wat zou voor DEZE specifieke bouw de meeste visuele 'brede'-impact geven (bv. meer focus op laterale delts, lat-breedte, of juist taille/vetpercentage) — wees specifiek, geen generiek lijstje.
Antwoord in het Nederlands, direct en feitelijk, max 6 zinnen. Dit is voor trainingsadvies, geen medisch of lichaamsbeeld-oordeel.`,
        });
        return { analysis, photoDate: photo.date };
      },
    },
    {
      name: "set_nutrition_goal",
      description: "Stel een nieuw voedingsdoel in (calorieën, eiwit, koolhydraten, vet per dag).",
      inputSchema: {
        type: "object",
        properties: {
          calories: { type: "number" },
          proteinGrams: { type: "number" },
          carbsGrams: { type: "number" },
          fatGrams: { type: "number" },
        },
        required: ["calories", "proteinGrams", "carbsGrams", "fatGrams"],
      },
      execute: async (input: { calories: number; proteinGrams: number; carbsGrams: number; fatGrams: number }) => {
        await prisma.nutritionGoal.create({ data: { userId, ...input } });
        return { updated: true };
      },
    },
  ];
}

async function addExerciseToProgramDay(programId: string, dayName: string, exercise: ExerciseInput) {
  let day = await prisma.programDay.findFirst({ where: { programId, name: { equals: dayName } } });
  if (!day) {
    const allDays = await prisma.programDay.findMany({ where: { programId } });
    day = allDays.find((d) => d.name.toLowerCase() === dayName.toLowerCase()) ?? null;
  }
  if (!day) {
    const existingCount = await prisma.programDay.count({ where: { programId } });
    day = await prisma.programDay.create({ data: { programId, name: dayName, order: existingCount } });
  }
  const resolveExercise = makeExerciseResolver();
  const resolved = await resolveExercise(exercise.exerciseName);
  const existingCount = await prisma.programExercise.count({ where: { programDayId: day.id } });
  await prisma.programExercise.create({
    data: {
      programDayId: day.id,
      exerciseId: resolved.id,
      order: existingCount,
      targetSets: exercise.targetSets,
      targetRepsMin: exercise.targetRepsMin,
      targetRepsMax: exercise.targetRepsMax,
      targetWeight: exercise.targetWeight,
    },
  });
  return { added: true, dayName: day.name };
}

async function findProgramExercise(userId: string, programName: string, dayName: string, exerciseName: string) {
  const programs = await prisma.workoutProgram.findMany({
    where: { userId },
    include: { days: { include: { exercises: { include: { exercise: true } } } } },
  });
  const program = programs.find((p) => p.name.toLowerCase() === programName.toLowerCase());
  if (!program) return null;
  const day = program.days.find((d) => d.name.toLowerCase() === dayName.toLowerCase());
  if (!day) return null;
  return day.exercises.find((e) => e.exercise.name.toLowerCase() === exerciseName.toLowerCase()) ?? null;
}
