import { prisma } from "@careeros/db";

async function main() {
  const ids = (await prisma.jobWatch.findMany({ select: { id: true } })).map((w) => w.id);
  const orphan = await prisma.discoveredJob.deleteMany({ where: { watchId: { notIn: ids } } });
  console.log("deleted orphan discoveredJobs (dangling watchId):", orphan.count);
  const total = await prisma.discoveredJob.count();
  const active = await prisma.discoveredJob.count({ where: { closedAt: null } });
  console.log("after cleanup -> total:", total, "active:", active);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
