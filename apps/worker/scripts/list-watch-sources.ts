import { prisma } from "@careeros/db";
import { WATCH_SOURCES } from "@careeros/shared";

async function main() {
  const watches = await prisma.jobWatch.findMany({ select: { id: true, name: true, sources: true } });
  const meta = Object.fromEntries(WATCH_SOURCES.map((s) => [s.id, { region: s.region, industries: s.industries, label: s.label, category: s.category }]));
  for (const w of watches) {
    console.log("\n=== " + w.name + " (sources=" + w.sources.length + ") ===");
    for (const id of w.sources) {
      const m = meta[id];
      console.log("  " + id + (m ? "  region=" + m.region + " industries=" + JSON.stringify(m.industries) + " category=" + m.category : "  [UNKNOWN]"));
    }
  }
  // 同时打印 indeed / boss / wantedly / green 等日系来源的真实 region
  console.log("\n=== 全部来源 region/industries 概览 ===");
  for (const s of WATCH_SOURCES) {
    console.log(s.id.padEnd(14) + " region=" + (s.region ?? "?").padEnd(8) + " industries=" + JSON.stringify(s.industries) + " cat=" + (s.category ?? "-"));
  }
  await prisma.$disconnect();
}
void main();
