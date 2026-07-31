import { prisma } from "@careeros/db";

async function main() {
  const watches = await prisma.jobWatch.findMany({
    select: { id: true, name: true, lastRunAt: true, lastError: true, enabled: true, sources: true, keywords: true },
    orderBy: { lastRunAt: "desc" },
  });
  console.log("total watches:", watches.length);
  for (const w of watches) {
    if (w.lastError) {
      console.log("\n---");
      const lastRun = w.lastRunAt ? w.lastRunAt.toISOString() : "never";
      console.log(w.name + " [enabled=" + w.enabled + "] [sources=" + w.sources.length + "] [lastRun=" + lastRun + "]");
      console.log("lastError:", w.lastError);
    }
  }
  await prisma.$disconnect();
}

void main();
