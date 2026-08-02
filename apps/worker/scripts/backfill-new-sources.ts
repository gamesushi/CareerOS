import { prisma } from "@careeros/db";
import { SOURCES } from "../src/sources";

const WANT = [
  "openai", "elevenlabs", "cursor", "cohere", "perplexity", "replit",
  "mercor", "fireworks", "lambda", "character", "runway", "supercell",
  "ghost", "xai", "thinkingmachines", "stabilityai",
];
const NEW16 = WANT.filter((id) => SOURCES[id]);

async function main() {
  // 清理上次残留的临时 watch（其 DiscoveredJob 保留，watchId 悬空无害）
  const stale = await prisma.jobWatch.findMany({ where: { name: "AI 来源回填(临时)" } });
  for (const w of stale) await prisma.jobWatch.delete({ where: { id: w.id } });

  const ref = await prisma.jobWatch.findFirst({ where: { name: "AI 岗位追踪" } });
  if (!ref) throw new Error("AI 岗位追踪 watch missing");
  const userId = ref.userId;

  const temp = await prisma.jobWatch.create({
    data: {
      name: "AI 来源回填(临时)",
      enabled: false,
      userId,
      sources: NEW16,
      keywords: [""], // 空关键词 = 全量，不过滤
      locations: [],
      excludeKeywords: [],
      intervalMinutes: 9999,
    },
  });
  console.log(`temp watch ${temp.id} sources=${NEW16.length}`);

  const { handleWatchPollJob } = await import("../src/jobs/watchPoll.ts");
  const r = await handleWatchPollJob(temp.id);
  console.log("poll result:", JSON.stringify(r));

  const counts: Record<string, number> = {};
  for (const s of NEW16) {
    counts[s] = await prisma.discoveredJob.count({ where: { source: s, closedAt: null } });
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log("new source active jobs:", JSON.stringify(counts, null, 0));
  console.log("TOTAL new active:", total);
  console.log("(temp watch kept, enabled=false, so it won't be auto-polled)");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
