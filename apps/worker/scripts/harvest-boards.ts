/**
 * 从 openapply 的真实 slug 清单批量收割 Greenhouse/Ashby/Lever 来源。
 * 1) 读取 /tmp/cc_{greenhouse,ashby,lever}_FINAL.txt
 * 2) 从 sources/index.ts 提取已接入 id 自动排除
 * 3) 各板取样 + 实网探测 jobs>0，输出 OK 清单到 /tmp/harvest_ok.txt
 * 不 import index.ts（避免连带 Playwright OOM）。
 */
import fs from "node:fs";

const ROOT = "/Users/hebeihang/DEV/tools/careeros/apps/worker/src/sources";
const INDEX = fs.readFileSync(`${ROOT}/index.ts`, "utf8");
// 提取所有 [xxxSource.id] 形式，假定 id === xxx（与现有约定一致）
const taken = new Set<string>();
for (const m of INDEX.matchAll(/\[(\w+)Source\.id\]/g)) taken.add(m[1].toLowerCase());
console.log(`已接入 id 数（估算）: ${taken.size}`);

function readSlugs(file: string): string[] {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
}

function classify(slug: string): "tech" | "game" | "finance" | "ai" | "general" {
  const s = slug.toLowerCase();
  if (/(game|gaming|bet|play|studio|esports|gg| interactive)/.test(s)) return "game";
  if (/(bank|fin|pay|crypto|coin|capital|venture|fund|trade|invest)/.test(s)) return "finance";
  if (/(ai|ml|robot|neuro|data|lab|bio|health)/.test(s)) return "ai";
  return "tech";
}

const ghRaw = readSlugs("/tmp/cc_greenhouse_FINAL.txt");
const ashbyRaw = readSlugs("/tmp/cc_ashby_FINAL.txt");
const leverRaw = readSlugs("/tmp/cc_lever_FINAL.txt");

function build(file: string, kind: "greenhouse" | "ashby" | "lever", cap: number) {
  const all: { id: string; kind: typeof kind; category: string }[] = [];
  const seen = new Set<string>();
  for (const slug of file) {
    if (taken.has(slug)) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    all.push({ id: slug, kind, category: classify(slug) });
  }
  // 均匀跨字母取样（避免只覆盖文件头部字母段）
  if (all.length <= cap) return all;
  const step = all.length / cap;
  const out: typeof all = [];
  for (let i = 0; i < cap; i++) out.push(all[Math.floor(i * step)]);
  return out;
}

const candidates = [
  ...build(ghRaw, "greenhouse", 500),
  ...build(ashbyRaw, "ashby", 300),
  ...build(leverRaw, "lever", 300),
];
console.log(`候选（排除已接后取样）: ${candidates.length}`);

async function countGh(s: string): Promise<number> {
  try {
    const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${s}/jobs?content=false`, { signal: AbortSignal.timeout(12_000) });
    if (!r.ok) return 0;
    const d = (await r.json()) as { jobs?: unknown[] };
    return (d.jobs ?? []).length;
  } catch { return 0; }
}
async function countAshby(s: string): Promise<number> {
  try {
    const r = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${s}`, { signal: AbortSignal.timeout(12_000) });
    if (!r.ok) return 0;
    const d = (await r.json()) as { jobs?: Array<{ isListed?: boolean }> };
    return (d.jobs ?? []).filter((j) => j.isListed !== false).length;
  } catch { return 0; }
}
async function countLever(s: string): Promise<number> {
  try {
    const r = await fetch(`https://api.lever.co/v0/postings/${s}?mode=json`, { signal: AbortSignal.timeout(12_000) });
    if (!r.ok) return 0;
    const d = (await r.json()) as unknown[];
    return Array.isArray(d) ? d.length : 0;
  } catch { return 0; }
}

async function probe(c: (typeof candidates)[number]): Promise<{ id: string; kind: string; category: string; jobs: number } | null> {
  let jobs = 0;
  if (c.kind === "greenhouse") jobs = await countGh(c.id);
  else if (c.kind === "ashby") jobs = await countAshby(c.id);
  else jobs = await countLever(c.id);
  if (jobs > 0) return { ...c, jobs };
  return null;
}

// 分板并发：GH 宽松(25)，Ashby 限速(6)，Lever(15)
async function pool<T, R>(items: T[], worker: (t: T) => Promise<R>, size: number) {
  const out: R[] = [];
  let i = 0;
  const runners = Array.from({ length: size }, async () => {
    while (i < items.length) {
      const idx = i++;
      out.push(await worker(items[idx]));
    }
  });
  await Promise.all(runners);
  return out;
}

(async () => {
  const gh = candidates.filter((c) => c.kind === "greenhouse");
  const ab = candidates.filter((c) => c.kind === "ashby");
  const lv = candidates.filter((c) => c.kind === "lever");
  const [r1, r2, r3] = await Promise.all([
    pool(gh, probe, 25),
    pool(ab, probe, 6),
    pool(lv, probe, 15),
  ]);
  const hits = ([...r1, ...r2, ...r3].filter(Boolean) as any[]).sort((a, b) => b.jobs - a.jobs);
  const lines = hits.map((h) => `OK\t${h.id}\t${h.kind}\t${h.category}\t${h.jobs}`);
  fs.writeFileSync("/tmp/harvest_ok.txt", lines.join("\n") + "\n");
  console.log(`\n=== OK 总数: ${hits.length} ===`);
  for (const h of hits) console.log(`OK\t${h.id}\t${h.kind}\t${h.category}\t${h.jobs}`);
  process.exit(0);
})();
