import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function getOrCreateSingleUser(email: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });
}
