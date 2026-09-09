import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const exercises: { name: string; muscleGroup: string; equipment?: string }[] = [
  { name: "Bankdrukken", muscleGroup: "Borst", equipment: "Barbell" },
  { name: "Schuine bankdrukken", muscleGroup: "Borst", equipment: "Barbell" },
  { name: "Dumbbell press", muscleGroup: "Borst", equipment: "Dumbbell" },
  { name: "Chest fly", muscleGroup: "Borst", equipment: "Cable" },
  { name: "Squat", muscleGroup: "Benen", equipment: "Barbell" },
  { name: "Front squat", muscleGroup: "Benen", equipment: "Barbell" },
  { name: "Beenpers", muscleGroup: "Benen", equipment: "Machine" },
  { name: "Romanian deadlift", muscleGroup: "Benen", equipment: "Barbell" },
  { name: "Beenstrekker", muscleGroup: "Benen", equipment: "Machine" },
  { name: "Beenbuiger", muscleGroup: "Benen", equipment: "Machine" },
  { name: "Kuitheffen staand", muscleGroup: "Benen", equipment: "Machine" },
  { name: "Deadlift", muscleGroup: "Rug", equipment: "Barbell" },
  { name: "Optrekken", muscleGroup: "Rug", equipment: "Bodyweight" },
  { name: "Lat pulldown", muscleGroup: "Rug", equipment: "Cable" },
  { name: "Bent-over row", muscleGroup: "Rug", equipment: "Barbell" },
  { name: "Kabelroeien zittend", muscleGroup: "Rug", equipment: "Cable" },
  { name: "Overhead press", muscleGroup: "Schouders", equipment: "Barbell" },
  { name: "Dumbbell shoulder press", muscleGroup: "Schouders", equipment: "Dumbbell" },
  { name: "Lateral raise", muscleGroup: "Schouders", equipment: "Dumbbell" },
  { name: "Face pull", muscleGroup: "Schouders", equipment: "Cable" },
  { name: "Barbell curl", muscleGroup: "Armen", equipment: "Barbell" },
  { name: "Dumbbell curl", muscleGroup: "Armen", equipment: "Dumbbell" },
  { name: "Triceps pushdown", muscleGroup: "Armen", equipment: "Cable" },
  { name: "Close-grip bankdrukken", muscleGroup: "Armen", equipment: "Barbell" },
  { name: "Plank", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Hanging leg raise", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Cable crunch", muscleGroup: "Core", equipment: "Cable" },
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
