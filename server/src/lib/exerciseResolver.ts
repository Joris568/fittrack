import { prisma } from "../db.js";

/** Resolves an exercise name to an existing Exercise (case-insensitive), or
 * creates a new custom one — shared by program import and the coach's tools. */
export function makeExerciseResolver() {
  const cache = new Map<string, Awaited<ReturnType<typeof prisma.exercise.findFirst>>>();

  return async function resolveExercise(name: string) {
    const key = name.toLowerCase();
    if (cache.has(key)) return cache.get(key)!;
    const existing = await prisma.exercise.findFirst({ where: { name: { equals: name } } });
    if (existing) {
      cache.set(key, existing);
      return existing;
    }
    // SQLite has no case-insensitive `equals`; fall back to an in-memory scan for a close match.
    const all = await prisma.exercise.findMany();
    const found = all.find((e) => e.name.toLowerCase() === key);
    if (found) {
      cache.set(key, found);
      return found;
    }
    const created = await prisma.exercise.create({
      data: { name, muscleGroup: "Overig", isCustom: true },
    });
    cache.set(key, created);
    return created;
  };
}
