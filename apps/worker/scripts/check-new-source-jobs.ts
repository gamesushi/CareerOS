import { prisma } from "@careeros/db";

const NEW = [
  "openai", "elevenlabs", "cursor", "cohere", "perplexity", "replit",
  "mercor", "fireworks", "lambda", "characterai", "runway", "supercell_ashby",
  "ghost", "xai", "thinkingmachines", "stability",
];

async function main() {
  const total = await prisma.discoveredJob.count();
  const totalActive = await prisma.discoveredJob.count({ where: { closedAt: null } });
  console.log(`\n=== 全库 DiscoveredJob: total=${total} active=${totalActive} ===\n`);

  let newJobs = 0;
  for (const s of NEW) {
    const c = await prisma.discoveredJob.count({ where: { source: s } });
    const active = await prisma.discoveredJob.count({ where: { source: s, closedAt: null } });
    if (c > 0) newJobs += active;
    console.log(`${s.padEnd(18)} total=${String(c).padStart(4)} active=${String(active).padStart(4)}`);
  }
  console.log(`\n=== 16 个新来源在招岗位合计: ${newJobs} ===`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
