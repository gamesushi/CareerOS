import { prisma } from "@careeros/db";
import { HARVESTED_IDS } from "../src/sources/harvested";

async function main() {
  const ids = HARVESTED_IDS;
  const newInDb = await prisma.discoveredJob.count({ where: { source: { in: ids } } });
  const total = await prisma.discoveredJob.count();
  const open = await prisma.discoveredJob.count({ where: { closedAt: null } });
  const ai = await prisma.jobWatch.findFirst({ where: { name: { contains: "AI" } }, orderBy: { createdAt: "desc" } });
  const aiCount = ai ? await prisma.discoveredJob.count({ where: { watchId: ai.id } }) : 0;
  console.log(`新来源(154)已入库: ${newInDb}`);
  console.log(`全库: ${total} (在招 ${open})  AI watch: ${aiCount}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
