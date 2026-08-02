import { prisma } from "@careeros/db";
import { SOURCE_IDS } from "../src/sources";

async function main() {
  const watches = await prisma.jobWatch.findMany({ select: { id: true, enabled: true, sources: true } });
  console.log(`当前 JobWatch 数: ${watches.length}, 已注册来源: ${SOURCE_IDS.length}`);
  for (const w of watches) {
    const cur = (w.sources as string[]) ?? [];
    const union = Array.from(new Set([...cur, ...SOURCE_IDS]));
    await prisma.jobWatch.update({ where: { id: w.id }, data: { sources: union as unknown as Prisma.InputJsonValue } });
    console.log(`watch ${w.id} (enabled=${w.enabled}): sources ${cur.length} -> ${union.length} (+${union.length - cur.length})`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
