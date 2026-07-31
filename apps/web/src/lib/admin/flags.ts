import { prisma } from "@careeros/db";

export function listFlags() {
  return prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
}

export function getFlag(id: string) {
  return prisma.featureFlag.findUnique({ where: { id } });
}
