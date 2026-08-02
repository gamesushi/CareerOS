import { prisma } from "@careeros/db";
import { HARVESTED_IDS } from "../src/sources/harvested";

async function main() {
  const watches = await prisma.jobWatch.findMany({});
  console.log(`发现 ${watches.length} 个 watch，待追加 ${HARVESTED_IDS.length} 个新来源`);
  for (const w of watches) {
    const src = ((w.sources as string[]) ?? []).filter(Boolean);
    const merged = Array.from(new Set([...src, ...HARVESTED_IDS]));
    await prisma.jobWatch.update({ where: { id: w.id }, data: { sources: merged } });
    console.log(`  ${w.name}: ${src.length} -> ${merged.length} (+${merged.length - src.length})`);
  }
  console.log("完成");
}
main()
  .then(() => process.exit(0))
  .catch((e: any) => {
    console.error(e);
    process.exit(1);
  });
