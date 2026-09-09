import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const exercises: { name: string; muscleGroup: string; equipment?: string }[] = [
  // ---- Borst ----
  { name: "Bankdrukken", muscleGroup: "Borst", equipment: "Barbell" },
  { name: "Schuine bankdrukken", muscleGroup: "Borst", equipment: "Barbell" },
  { name: "Decline bankdrukken", muscleGroup: "Borst", equipment: "Barbell" },
  { name: "Dumbbell press", muscleGroup: "Borst", equipment: "Dumbbell" },
  { name: "Schuine dumbbell press", muscleGroup: "Borst", equipment: "Dumbbell" },
  { name: "Dumbbell fly", muscleGroup: "Borst", equipment: "Dumbbell" },
  { name: "Chest press machine", muscleGroup: "Borst", equipment: "Machine" },
  { name: "Pec deck", muscleGroup: "Borst", equipment: "Machine" },
  { name: "Chest fly (kabel)", muscleGroup: "Borst", equipment: "Cable" },
  { name: "Cable crossover", muscleGroup: "Borst", equipment: "Cable" },
  { name: "Push-up", muscleGroup: "Borst", equipment: "Bodyweight" },
  { name: "Dips (borst)", muscleGroup: "Borst", equipment: "Bodyweight" },

  // ---- Rug ----
  { name: "Deadlift", muscleGroup: "Rug", equipment: "Barbell" },
  { name: "Sumo deadlift", muscleGroup: "Rug", equipment: "Barbell" },
  { name: "Bent-over row", muscleGroup: "Rug", equipment: "Barbell" },
  { name: "Pendlay row", muscleGroup: "Rug", equipment: "Barbell" },
  { name: "T-bar row", muscleGroup: "Rug", equipment: "Barbell" },
  { name: "Dumbbell row", muscleGroup: "Rug", equipment: "Dumbbell" },
  { name: "Chest-supported row", muscleGroup: "Rug", equipment: "Dumbbell" },
  { name: "Optrekken", muscleGroup: "Rug", equipment: "Bodyweight" },
  { name: "Optrekken (ondergrepen)", muscleGroup: "Rug", equipment: "Bodyweight" },
  { name: "Lat pulldown", muscleGroup: "Rug", equipment: "Cable" },
  { name: "Lat pulldown (nauwe grip)", muscleGroup: "Rug", equipment: "Cable" },
  { name: "Kabelroeien zittend", muscleGroup: "Rug", equipment: "Cable" },
  { name: "Straight-arm pulldown", muscleGroup: "Rug", equipment: "Cable" },
  { name: "Roeimachine", muscleGroup: "Rug", equipment: "Machine" },
  { name: "Rugstrekker (hyperextension)", muscleGroup: "Rug", equipment: "Bodyweight" },
  { name: "Shrugs", muscleGroup: "Rug", equipment: "Barbell" },

  // ---- Benen ----
  { name: "Squat", muscleGroup: "Benen", equipment: "Barbell" },
  { name: "Front squat", muscleGroup: "Benen", equipment: "Barbell" },
  { name: "Hack squat", muscleGroup: "Benen", equipment: "Machine" },
  { name: "Goblet squat", muscleGroup: "Benen", equipment: "Dumbbell" },
  { name: "Bulgarian split squat", muscleGroup: "Benen", equipment: "Dumbbell" },
  { name: "Lunges", muscleGroup: "Benen", equipment: "Dumbbell" },
  { name: "Walking lunges", muscleGroup: "Benen", equipment: "Dumbbell" },
  { name: "Beenpers", muscleGroup: "Benen", equipment: "Machine" },
  { name: "Romanian deadlift", muscleGroup: "Benen", equipment: "Barbell" },
  { name: "Stijfbeen deadlift (dumbbell)", muscleGroup: "Benen", equipment: "Dumbbell" },
  { name: "Beenstrekker", muscleGroup: "Benen", equipment: "Machine" },
  { name: "Beenbuiger zittend", muscleGroup: "Benen", equipment: "Machine" },
  { name: "Beenbuiger liggend", muscleGroup: "Benen", equipment: "Machine" },
  { name: "Hip thrust", muscleGroup: "Benen", equipment: "Barbell" },
  { name: "Glute bridge", muscleGroup: "Benen", equipment: "Bodyweight" },
  { name: "Cable kickback", muscleGroup: "Benen", equipment: "Cable" },
  { name: "Hip abductie machine", muscleGroup: "Benen", equipment: "Machine" },
  { name: "Hip adductie machine", muscleGroup: "Benen", equipment: "Machine" },
  { name: "Kuitheffen staand", muscleGroup: "Benen", equipment: "Machine" },
  { name: "Kuitheffen zittend", muscleGroup: "Benen", equipment: "Machine" },
  { name: "Kuitheffen (leg press)", muscleGroup: "Benen", equipment: "Machine" },

  // ---- Schouders ----
  { name: "Overhead press", muscleGroup: "Schouders", equipment: "Barbell" },
  { name: "Push press", muscleGroup: "Schouders", equipment: "Barbell" },
  { name: "Dumbbell shoulder press", muscleGroup: "Schouders", equipment: "Dumbbell" },
  { name: "Arnold press", muscleGroup: "Schouders", equipment: "Dumbbell" },
  { name: "Shoulder press machine", muscleGroup: "Schouders", equipment: "Machine" },
  { name: "Lateral raise", muscleGroup: "Schouders", equipment: "Dumbbell" },
  { name: "Lateral raise (kabel)", muscleGroup: "Schouders", equipment: "Cable" },
  { name: "Front raise", muscleGroup: "Schouders", equipment: "Dumbbell" },
  { name: "Reverse fly", muscleGroup: "Schouders", equipment: "Dumbbell" },
  { name: "Reverse pec deck", muscleGroup: "Schouders", equipment: "Machine" },
  { name: "Face pull", muscleGroup: "Schouders", equipment: "Cable" },
  { name: "Upright row", muscleGroup: "Schouders", equipment: "Barbell" },

  // ---- Armen ----
  { name: "Barbell curl", muscleGroup: "Armen", equipment: "Barbell" },
  { name: "EZ-bar curl", muscleGroup: "Armen", equipment: "Barbell" },
  { name: "Dumbbell curl", muscleGroup: "Armen", equipment: "Dumbbell" },
  { name: "Hammer curl", muscleGroup: "Armen", equipment: "Dumbbell" },
  { name: "Concentratie curl", muscleGroup: "Armen", equipment: "Dumbbell" },
  { name: "Preacher curl", muscleGroup: "Armen", equipment: "Barbell" },
  { name: "Kabel curl", muscleGroup: "Armen", equipment: "Cable" },
  { name: "Triceps pushdown", muscleGroup: "Armen", equipment: "Cable" },
  { name: "Triceps pushdown (touw)", muscleGroup: "Armen", equipment: "Cable" },
  { name: "Overhead triceps extension", muscleGroup: "Armen", equipment: "Dumbbell" },
  { name: "Skull crusher", muscleGroup: "Armen", equipment: "Barbell" },
  { name: "Close-grip bankdrukken", muscleGroup: "Armen", equipment: "Barbell" },
  { name: "Dips (triceps)", muscleGroup: "Armen", equipment: "Bodyweight" },
  { name: "Triceps kickback", muscleGroup: "Armen", equipment: "Dumbbell" },
  { name: "Polscurl (onderarm)", muscleGroup: "Armen", equipment: "Barbell" },

  // ---- Core ----
  { name: "Plank", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Zijplank", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Hanging leg raise", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Sit-up", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Crunch", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Cable crunch", muscleGroup: "Core", equipment: "Cable" },
  { name: "Ab wheel rollout", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Russian twist", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Woodchopper (kabel)", muscleGroup: "Core", equipment: "Cable" },
  { name: "Back extension", muscleGroup: "Core", equipment: "Bodyweight" },

  // ---- Full body / functioneel ----
  { name: "Kettlebell swing", muscleGroup: "Full body", equipment: "Kettlebell" },
  { name: "Farmers carry", muscleGroup: "Full body", equipment: "Dumbbell" },
  { name: "Clean and press", muscleGroup: "Full body", equipment: "Barbell" },
  { name: "Burpee", muscleGroup: "Full body", equipment: "Bodyweight" },
  { name: "Box jump", muscleGroup: "Full body", equipment: "Bodyweight" },
];

async function main() {
  for (const ex of exercises) {
    await prisma.exercise.upsert({
      where: { name: ex.name },
      update: {},
      create: ex,
    });
  }
  console.log(`Seeded ${exercises.length} exercises.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
