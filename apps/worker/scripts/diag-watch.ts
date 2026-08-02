import { prisma } from "@careeros/db";

async function main() {
  const watches = await prisma.jobWatch.findMany({
    select: { id: true, name: true, enabled: true, sources: true, keywords: true },
  });
  for (const w of watches) {
    const srcs: string[] = Array.isArray(w.sources) ? (w.sources as string[]) : [];
    const kws: string[] = Array.isArray(w.keywords) ? (w.keywords as string[]) : [];
    const hasNew = srcs.filter((s) => ["openai","elevenlabs","cursor","xai","thinkingmachines","stability"].includes(s));
    console.log(`\n[${w.name}] enabled=${w.enabled} sources=${srcs.length} keywords=${kws.length}`);
    console.log(`  keywords: ${kws.slice(0, 12).join(", ")}${kws.length > 12 ? " ..." : ""}`);
    console.log(`  new-AI sources present: ${hasNew.length ? hasNew.join(",") : "NONE"}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
