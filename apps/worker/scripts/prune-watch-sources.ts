import { prisma } from "@careeros/db";
import { WATCH_SOURCES } from "@careeros/shared";

// 把指定 watch 的来源裁剪为「中国 + 游戏」匹配集（与页面 filterSources 同逻辑）
async function main() {
  const name = process.argv[2] ?? "发行";
  const regionIds = ["china"];
  const industryIds = ["game"];

  const matched = WATCH_SOURCES.filter((s) => {
    const regionMatch = regionIds.includes(s.region);
    const industryMatch = s.industries.some((i) => industryIds.includes(i));
    return regionMatch && industryMatch;
  }).map((s) => s.id);
  console.log("「中国+游戏」匹配来源:", matched);

  const watch = await prisma.jobWatch.findFirst({ where: { name } });
  if (!watch) {
    console.error("watch not found:", name);
    process.exit(1);
  }
  console.log(`\n更新前 ${watch.name}: ${watch.sources.length} 个来源`);
  console.log("  ", watch.sources.join(", "));

  await prisma.jobWatch.update({
    where: { id: watch.id },
    data: { sources: matched, lastError: null },
  });

  const after = await prisma.jobWatch.findFirst({ where: { id: watch.id } });
  console.log(`\n更新后 ${after!.name}: ${after!.sources.length} 个来源`);
  console.log("  ", after!.sources.join(", "));
  await prisma.$disconnect();
}
void main();
