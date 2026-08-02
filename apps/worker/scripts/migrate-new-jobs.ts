import { prisma } from "@careeros/db";

async function main() {
  const temp = await prisma.jobWatch.findFirst({ where: { name: "AI 来源回填(临时)" } });
  if (!temp) { console.log("no temp watch, nothing to do"); return; }
  const ai = await prisma.jobWatch.findFirst({ where: { name: "AI 岗位追踪" } });
  if (!ai) { console.log("AI 岗位追踪 watch missing"); return; }

  const rows = await prisma.discoveredJob.findMany({
    where: { watchId: temp.id },
    select: { id: true, source: true, externalId: true },
  });
  let moved = 0, dup = 0;
  for (const r of rows) {
    const exists = await prisma.discoveredJob.findFirst({
      where: { watchId: ai.id, source: r.source, externalId: r.externalId },
    });
    if (exists) { await prisma.discoveredJob.delete({ where: { id: r.id } }); dup++; }
    else { await prisma.discoveredJob.update({ where: { id: r.id }, data: { watchId: ai.id } }); moved++; }
  }
  await prisma.jobWatch.delete({ where: { id: temp.id } });
  console.log(`moved=${moved} dupRemoved=${dup}, temp watch deleted`);

  const total = await prisma.discoveredJob.count();
  const active = await prisma.discoveredJob.count({ where: { closedAt: null } });
  console.log("final -> total:", total, "active:", active);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
