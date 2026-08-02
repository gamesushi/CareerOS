import { prisma } from "@careeros/db";

async function main() {
  // 1) 清理临时 watch
  const tmp = await prisma.jobWatch.findFirst({
    where: { name: { contains: "TEMP-FULL" } },
  });
  if (tmp) {
    console.log(`TMP_DELETE found ${tmp.id}`);
    await prisma.jobWatch.delete({ where: { id: tmp.id } });
    console.log("TMP_DELETE done");
  } else {
    console.log("TMP_DELETE none");
  }

  // 2) AI 监测任务
  const ai = await prisma.jobWatch.findFirst({
    where: { name: { contains: "AI" } },
    orderBy: { createdAt: "desc" },
  });
  if (ai) {
    const cnt = await prisma.discoveredJob.count({ where: { watchId: ai.id } });
    console.log(`AI_WATCH id=${ai.id} jobs=${cnt} sources=${(ai.sources as string[] | undefined)?.length ?? "?"} keywords=${(ai.keywords as string[] | undefined)?.join(",") ?? "(empty=all)"}`);

    const bySource = await prisma.discoveredJob.groupBy({
      by: ["source"],
      where: { watchId: ai.id },
      _count: { _all: true },
      orderBy: { _count: { source: "desc" } },
      take: 15,
    });
    console.log("AI_TOP_SOURCES:");
    for (const r of bySource) console.log(`  ${r.source.padEnd(16)} ${r._count._all}`);
  } else {
    console.log("AI_WATCH none found");
  }

  // 3) 全库
  const total = await prisma.discoveredJob.count();
  const open = await prisma.discoveredJob.count({ where: { closedAt: null } });
  console.log(`DB_TOTAL ${total} DB_OPEN ${open}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("ERR", e instanceof Error ? e.message : e);
    process.exit(1);
  });
