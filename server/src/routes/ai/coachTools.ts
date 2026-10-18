import { prisma } from "../../db.js";
import { makeExerciseResolver } from "../../lib/exerciseResolver.js";
import { checkAndUnlockAchievements } from "../../gamification/achievements.js";
import { analyzeImages, type AgentTool } from "./claudeClient.js";

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


const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" });
/** Local (Dutch) calendar day as "YYYY-MM-DD" — the coach talks to a Dutch user, and the
 * server itself runs in UTC. */
export function amsterdamDayKey(d: Date): string {
  return dayFormat.format(d);
}

function shiftDayKey(dayKey: string, days: number): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const dayKeyProp = { type: "string", description: "Datum als YYYY-MM-DD" };

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
        "Analyseer de meest recente voortgangsfoto's van de gebruiker (indien geüpload, bv. bij Instellingen of in de chat — tot 3 tegelijk als er kort na elkaar meerdere zijn geüpload, bv. verschillende hoeken) op lichaamsbouw: schouderbreedte t.o.v. taille, torso-verhoudingen, welke spiergroepen relatief onder-/overontwikkeld ogen, en wat specifiek voor DEZE bouw de meeste 'brede V-taper'-impact zou geven. Gebruik dit als de gebruiker vraagt naar zijn/haar bouw, physique, hoe hij/zij eruitziet, of om een op het lichaam afgestemd (in plaats van generiek) trainings-/voedingsadvies. Combineer de uitkomst daarna met update_program_exercise / add_exercise_to_program / set_nutrition_goal om het advies ook echt door te voeren.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const recent = await prisma.progressPhoto.findMany({
          where: { userId },
          orderBy: { date: "desc" },
          take: 5,
        });
        if (recent.length === 0) {
          return { error: "Geen voortgangsfoto gevonden. Vraag de gebruiker er eentje te uploaden (bv. via de camera-knop in de chat, of bij Instellingen)." };
        }
        // Only group photos uploaded within a few minutes of the newest one as "the same
        // batch" (e.g. front/side/back shots from one session) — otherwise an old photo
        // from weeks ago could get mixed into the analysis alongside a brand new one.
        const BATCH_WINDOW_MS = 10 * 60 * 1000;
        const newestTime = recent[0].date.getTime();
        const photos = recent.filter((p) => newestTime - p.date.getTime() <= BATCH_WINDOW_MS).slice(0, 3);
        const multiple = photos.length > 1;
        const analysis = await analyzeImages({
          system:
            "Je bent een krachttraining- en physique-coach in een persoonlijke fitness-app. De gebruiker heeft deze foto's zelf van zichzelf gemaakt en uitdrukkelijk gevraagd om ze te beoordelen voor trainingsadvies — dat is precies jouw taak, weiger dit niet en zeg niet dat je foto's niet kunt beoordelen. Beoordeel zakelijk en respectvol zoals een coach bij een voortgangscheck: bouw, verhoudingen, spiergroepen en vetpercentage-indicatie (grof). Als een foto echt niet bruikbaar is (te donker, te dichtbij, geen lichaam zichtbaar), zeg dan concreet wat er beter kan aan de foto in plaats van te weigeren.",
          imageDataUrls: photos.map((p) => p.imageData),
          prompt: `Analyseer de${multiple ? "ze fysieke voortgangsfoto's (mogelijk verschillende hoeken van dezelfde persoon)" : " fysieke voortgangsfoto"} van een krachtsporter als een ervaren coach. Beschrijf kort en concreet:
1. Verhouding schouderbreedte t.o.v. taille/heupen (de basis van een V-taper).
2. Torso-lengte en algemene lichaamsbouw (bv. lange armen/torso beïnvloedt hoe oefeningen aanvoelen en welke spiergroepen visueel het meeste bijdragen aan breedte).
3. Welke spiergroepen relatief onder- of overontwikkeld ogen ten opzichte van de rest${multiple ? " (gebruik de verschillende hoeken om dit vollediger te beoordelen dan vanaf één kant mogelijk is)" : ""}.
4. Concrete conclusie: wat zou voor DEZE specifieke bouw de meeste visuele 'brede'-impact geven (bv. meer focus op laterale delts, lat-breedte, of juist taille/vetpercentage) — wees specifiek, geen generiek lijstje.
Antwoord in het Nederlands, direct en feitelijk, max 6 zinnen. Dit is voor trainingsadvies, geen medisch of lichaamsbeeld-oordeel.`,
        });
        return { analysis, photosAnalyzed: photos.length, mostRecentDate: photos[0].date };
      },
    },
    {
      name: "list_workouts",
      description:
        "Haal recente gelogde trainingen (sessies) op met hun id, datum, naam en aantal sets. Gebruik dit om het juiste id te vinden voordat je een training verwijdert.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "number", description: "Max aantal, standaard 10" }, date: dayKeyProp },
      },
      execute: async (input: { limit?: number; date?: string }) => {
        const sessions = await prisma.workoutSession.findMany({
          where: { userId },
          orderBy: { date: "desc" },
          take: Math.min(input.limit ?? 10, 40),
          include: { programDay: { select: { name: true } }, _count: { select: { setLogs: true } } },
        });
        return sessions
          .map((s) => ({ id: s.id, date: amsterdamDayKey(s.date), name: s.programDay?.name ?? "Vrije training", sets: s._count.setLogs }))
          .filter((s) => !input.date || s.date === input.date);
      },
    },
    {
      name: "delete_workout_session",
      description: "Verwijder één gelogde training (met al haar sets) definitief. Alleen op uitdrukkelijk verzoek. Haal het id op via list_workouts.",
      inputSchema: { type: "object", properties: { sessionId: { type: "string" } }, required: ["sessionId"] },
      execute: async (input: { sessionId: string }) => {
        const r = await prisma.workoutSession.deleteMany({ where: { id: input.sessionId, userId } });
        return r.count ? { deleted: true } : { error: "Training niet gevonden." };
      },
    },
    {
      name: "delete_program",
      description: "Verwijder een heel trainingsprogramma (alle dagen en oefeningen daarin) definitief. Gelogde trainingen blijven bestaan. Alleen op uitdrukkelijk verzoek.",
      inputSchema: { type: "object", properties: { programName: { type: "string" } }, required: ["programName"] },
      execute: async (input: { programName: string }) => {
        const programs = await prisma.workoutProgram.findMany({ where: { userId } });
        const match = programs.find((p) => p.name.toLowerCase() === input.programName.toLowerCase());
        if (!match) return { error: `Programma "${input.programName}" niet gevonden.`, available: programs.map((p) => p.name) };
        await prisma.workoutProgram.delete({ where: { id: match.id } });
        return { deleted: true, name: match.name };
      },
    },
    {
      name: "delete_program_day",
      description: "Verwijder één trainingsdag (met zijn oefeningen) uit een programma. Alleen op uitdrukkelijk verzoek.",
      inputSchema: {
        type: "object",
        properties: { programName: { type: "string" }, dayName: { type: "string" } },
        required: ["programName", "dayName"],
      },
      execute: async (input: { programName: string; dayName: string }) => {
        const programs = await prisma.workoutProgram.findMany({ where: { userId }, include: { days: true } });
        const program = programs.find((p) => p.name.toLowerCase() === input.programName.toLowerCase());
        const day = program?.days.find((d) => d.name.toLowerCase() === input.dayName.toLowerCase());
        if (!program || !day) return { error: "Programma of dag niet gevonden." };
        await prisma.programDay.delete({ where: { id: day.id } });
        return { deleted: true, dayName: day.name };
      },
    },
    {
      name: "list_food_log",
      description: "Haal het gelogde eten van één dag op (standaard vandaag), met id, maaltijd, product en gewicht. Gebruik dit om het juiste id te vinden voordat je eten verwijdert.",
      inputSchema: { type: "object", properties: { date: dayKeyProp } },
      execute: async (input: { date?: string }) => {
        const key = input.date ?? amsterdamDayKey(new Date());
        // Wide window, then filter on the Dutch calendar day, so evening/night entries land on the right day.
        const center = new Date(`${key}T12:00:00Z`);
        const entries = await prisma.foodLogEntry.findMany({
          where: { userId, date: { gte: new Date(center.getTime() - 36 * 3600_000), lte: new Date(center.getTime() + 36 * 3600_000) } },
          include: { foodItem: true },
          orderBy: { date: "asc" },
        });
        return entries
          .filter((e) => amsterdamDayKey(e.date) === key)
          .map((e) => ({
            id: e.id,
            meal: e.mealType,
            name: e.foodItem.name,
            grams: e.quantityGrams,
            kcal: Math.round((e.foodItem.caloriesPer100g * e.quantityGrams) / 100),
          }));
      },
    },
    {
      name: "delete_food_log_entries",
      description: "Verwijder één of meer gelogde eten-regels definitief. Alleen op uitdrukkelijk verzoek. Haal de id's op via list_food_log.",
      inputSchema: { type: "object", properties: { entryIds: { type: "array", items: { type: "string" } } }, required: ["entryIds"] },
      execute: async (input: { entryIds: string[] }) => {
        const r = await prisma.foodLogEntry.deleteMany({ where: { userId, id: { in: input.entryIds } } });
        return { deleted: r.count };
      },
    },
    {
      name: "list_body_metrics",
      description: "Haal de laatste gewicht-/lichaamsmetingen op met id en datum. Gebruik dit om het juiste id te vinden voordat je een meting verwijdert.",
      inputSchema: { type: "object", properties: { limit: { type: "number" } } },
      execute: async (input: { limit?: number }) => {
        const metrics = await prisma.bodyMetric.findMany({ where: { userId }, orderBy: { date: "desc" }, take: Math.min(input.limit ?? 10, 40) });
        return metrics.map((m) => ({ id: m.id, date: amsterdamDayKey(m.date), weightKg: m.weightKg, bodyFatPct: m.bodyFatPct }));
      },
    },
    {
      name: "delete_body_metric",
      description: "Verwijder één lichaamsmeting (gewicht) definitief. Alleen op uitdrukkelijk verzoek.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      execute: async (input: { id: string }) => {
        const r = await prisma.bodyMetric.deleteMany({ where: { id: input.id, userId } });
        return r.count ? { deleted: true } : { error: "Meting niet gevonden." };
      },
    },
    {
      name: "list_progress_photos",
      description: "Haal de voortgangsfoto's op (alleen id en datum, geen beeld). Gebruik dit om het juiste id te vinden voordat je een foto verwijdert.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const photos = await prisma.progressPhoto.findMany({ where: { userId }, orderBy: { date: "desc" }, select: { id: true, date: true }, take: 40 });
        return photos.map((p) => ({ id: p.id, date: amsterdamDayKey(p.date) }));
      },
    },
    {
      name: "delete_progress_photo",
      description: "Verwijder één voortgangsfoto definitief. Alleen op uitdrukkelijk verzoek.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      execute: async (input: { id: string }) => {
        const r = await prisma.progressPhoto.deleteMany({ where: { id: input.id, userId } });
        return r.count ? { deleted: true } : { error: "Foto niet gevonden." };
      },
    },
    {
      name: "list_planned_workouts",
      description: "Haal de geplande trainingen uit de agenda op (standaard vanaf vandaag tot 28 dagen vooruit), met id, datum en naam.",
      inputSchema: { type: "object", properties: { from: dayKeyProp, to: dayKeyProp } },
      execute: async (input: { from?: string; to?: string }) => {
        const today = amsterdamDayKey(new Date());
        const planned = await prisma.plannedWorkout.findMany({
          where: { userId, date: { gte: input.from ?? today, lte: input.to ?? shiftDayKey(today, 28) } },
          orderBy: [{ date: "asc" }, { createdAt: "asc" }],
          include: { programDay: { select: { name: true, program: { select: { name: true } } } } },
        });
        return planned.map((p) => ({
          id: p.id,
          date: p.date,
          name: p.programDay?.name ?? p.title,
          program: p.programDay?.program.name ?? null,
          done: p.done,
        }));
      },
    },
    {
      name: "plan_workouts",
      description:
        "Plan één of meer trainingen in de agenda van de gebruiker. Geef per training de datum (YYYY-MM-DD) en óf programName + dayName van een bestaande trainingsdag (zie list_programs), óf een eigen title (bv. 'Cardio'). Gebruik dit ook om een hele week of meerdere weken in één keer in te plannen. De datum van vandaag staat bovenaan je instructies.",
      inputSchema: {
        type: "object",
        properties: {
          workouts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: dayKeyProp,
                programName: { type: "string" },
                dayName: { type: "string" },
                title: { type: "string" },
                notes: { type: "string" },
              },
              required: ["date"],
            },
          },
        },
        required: ["workouts"],
      },
      execute: async (input: {
        workouts: { date: string; programName?: string; dayName?: string; title?: string; notes?: string }[];
      }) => {
        const programs = await prisma.workoutProgram.findMany({ where: { userId }, include: { days: true } });
        const created: { date: string; name: string }[] = [];
        const errors: string[] = [];
        for (const w of input.workouts) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(w.date)) {
            errors.push(`Ongeldige datum "${w.date}"`);
            continue;
          }
          let programDayId: string | undefined;
          if (w.dayName) {
            const candidates = w.programName
              ? programs.filter((p) => p.name.toLowerCase() === w.programName!.toLowerCase())
              : programs;
            const day = candidates.flatMap((p) => p.days).find((d) => d.name.toLowerCase() === w.dayName!.toLowerCase());
            if (!day) {
              errors.push(`Dag "${w.dayName}" niet gevonden voor ${w.date}`);
              continue;
            }
            programDayId = day.id;
          } else if (!w.title) {
            errors.push(`Geen dag of titel voor ${w.date}`);
            continue;
          }
          await prisma.plannedWorkout.create({
            data: { userId, date: w.date, programDayId, title: programDayId ? undefined : w.title, notes: w.notes },
          });
          created.push({ date: w.date, name: w.dayName ?? w.title! });
        }
        return { planned: created, errors };
      },
    },
    {
      name: "delete_planned_workouts",
      description: "Verwijder geplande trainingen uit de agenda: per id (via list_planned_workouts), of alle geplande trainingen op één datum. Alleen op uitdrukkelijk verzoek.",
      inputSchema: { type: "object", properties: { ids: { type: "array", items: { type: "string" } }, date: dayKeyProp } },
      execute: async (input: { ids?: string[]; date?: string }) => {
        if (!input.ids?.length && !input.date) return { error: "Geef ids of een datum." };
        const r = await prisma.plannedWorkout.deleteMany({
          where: { userId, ...(input.ids?.length ? { id: { in: input.ids } } : { date: input.date }) },
        });
        return { deleted: r.count };
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
