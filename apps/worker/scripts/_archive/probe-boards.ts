/**
 * 探测候选公司是否使用 Greenhouse 或 Ashby 公开招聘板。
 * 对每个候选同时尝试两端，只认实网返回 jobs>0 的，输出可复制接入的 OK 清单。
 * 不 import index.ts（避免连带加载 Playwright 导致 OOM）。
 */

type Cat = "tech" | "game" | "finance" | "ai" | "general";
interface Cand { id: string; label: string; category: Cat }

const CANDIDATES: Cand[] = [
  // ── 半导体 / 硬件（当前来源完全空白，优先全量覆盖）──
  { id: "nvidia", label: "NVIDIA", category: "tech" },
  { id: "intel", label: "Intel", category: "tech" },
  { id: "amd", label: "AMD", category: "tech" },
  { id: "qualcomm", label: "Qualcomm", category: "tech" },
  { id: "asml", label: "ASML", category: "tech" },
  { id: "tsmc", label: "TSMC", category: "tech" },
  { id: "cadence", label: "Cadence", category: "tech" },
  { id: "synopsys", label: "Synopsys", category: "tech" },
  { id: "arm", label: "Arm", category: "tech" },
  { id: "broadcom", label: "Broadcom", category: "tech" },
  { id: "micron", label: "Micron", category: "tech" },
  { id: "marvell", label: "Marvell", category: "tech" },
  { id: "texasinstruments", label: "Texas Instruments", category: "tech" },
  { id: "globalfoundries", label: "GlobalFoundries", category: "tech" },
  { id: "appliedmaterials", label: "Applied Materials", category: "tech" },
  { id: "lamresearch", label: "Lam Research", category: "tech" },
  { id: "kla", label: "KLA", category: "tech" },
  { id: "teradyne", label: "Teradyne", category: "tech" },
  { id: "analogdevices", label: "Analog Devices", category: "tech" },
  { id: "skyworks", label: "Skyworks", category: "tech" },
  { id: "infineon", label: "Infineon", category: "tech" },
  { id: "nxp", label: "NXP", category: "tech" },
  { id: "renesas", label: "Renesas", category: "tech" },
  { id: "stmicroelectronics", label: "STMicroelectronics", category: "tech" },
  { id: "onsemiconductor", label: "onsemi", category: "tech" },
  { id: "qorvo", label: "Qorvo", category: "tech" },
  { id: "microchip", label: "Microchip", category: "tech" },
  { id: "amkor", label: "Amkor", category: "tech" },
  // ── 游戏补充（避开已知不暴露公开板的 EA/Ubisoft/Zynga/King/Blizzard/Activision）──
  { id: "squareenix", label: "Square Enix", category: "game" },
  { id: "sega", label: "SEGA", category: "game" },
  { id: "konami", label: "Konami", category: "game" },
  { id: "capcom", label: "Capcom", category: "game" },
  { id: "cygames", label: "Cygames", category: "game" },
  { id: "koeitecmo", label: "Koei Tecmo", category: "game" },
  { id: "nexon", label: "Nexon", category: "game" },
  { id: "ncsoft", label: "NCSoft", category: "game" },
  { id: "netmarble", label: "Netmarble", category: "game" },
  { id: "gameloft", label: "Gameloft", category: "game" },
  { id: "rovio", label: "Rovio", category: "game" },
  { id: "unity", label: "Unity", category: "game" },
  { id: "atlus", label: "Atlus", category: "game" },
  { id: "fromsoftware", label: "FromSoftware", category: "game" },
  { id: "behaviour", label: "Behaviour Interactive", category: "game" },
  // ── AI / 初创补充（避开已接的 openai/cohere/perplexity/elevenlabs/character/replit/runway/mercor/fireworks/lambda/cursor/supercell/ghost/xai/stabilityai/thinkingmachines）──
  { id: "huggingface", label: "Hugging Face", category: "ai" },
  { id: "scaleai", label: "Scale AI", category: "ai" },
  { id: "mistral", label: "Mistral AI", category: "ai" },
  { id: "together", label: "Together AI", category: "ai" },
  { id: "midjourney", label: "Midjourney", category: "ai" },
  { id: "pika", label: "Pika", category: "ai" },
  { id: "decagon", label: "Decagon", category: "ai" },
  { id: "codeium", label: "Codeium", category: "ai" },
  { id: "anyscale", label: "Anyscale", category: "ai" },
  { id: "hebbia", label: "Hebbia", category: "ai" },
  { id: "harvey", label: "Harvey", category: "ai" },
  { id: "replicai", label: "Replit AI", category: "ai" },
  { id: "ramp", label: "Ramp", category: "tech" },
  { id: "rippling", label: "Rippling", category: "tech" },
  { id: "notion", label: "Notion", category: "tech" },
  { id: "linear", label: "Linear", category: "tech" },
  { id: "vercel", label: "Vercel", category: "tech" },
  { id: "supabase", label: "Supabase", category: "tech" },
  { id: "retool", label: "Retool", category: "tech" },
  // ── 科技补充（避开已接的 stripe/datadog/figma/cloudflare/twilio/gitlab/okta/zscaler/mongodb/databricks/fastly/discord/pinterest/reddit/twitch/lyft/instacart/gemini/coursera/duolingo/airbnb/tripadvisor/webflow/disney/cockroachlabs/planetscale/clickhouse/peloton/oura/calm/waymo/figureai/watershed/redwoodmaterials/udemy/udacity/masterclass/kayak/flexport/newrelic/honeycomb/sigmacomputing/amplitude/mixpanel/roblox/spotify/binance/angellist/theAthletic/houzz 等）──
  { id: "snowflake", label: "Snowflake", category: "tech" },
  { id: "palantir", label: "Palantir", category: "tech" },
  { id: "servicenow", label: "ServiceNow", category: "tech" },
  { id: "shopify", label: "Shopify", category: "tech" },
  { id: "netflix", label: "Netflix", category: "tech" },
  { id: "uber", label: "Uber", category: "tech" },
  { id: "snap", label: "Snap", category: "tech" },
  { id: "atlassian", label: "Atlassian", category: "tech" },
  { id: "square", label: "Block (Square)", category: "tech" },
  { id: "doordash", label: "DoorDash", category: "tech" },
  // ── 日本企业 ──
  { id: "rakuten", label: "Rakuten", category: "tech" },
  { id: "sony", label: "Sony", category: "tech" },
  { id: "line", label: "LINE", category: "tech" },
  { id: "mercari", label: "Mercari", category: "tech" },
  { id: "cyberagent", label: "CyberAgent", category: "tech" },
  { id: "mixi", label: "mixi", category: "tech" },
  { id: "gumi", label: "gumi", category: "game" },
  { id: "akatsuki", label: "Akatsuki", category: "game" },
  { id: "colopl", label: "COLOPL", category: "game" },
  { id: "smartnews", label: "SmartNews", category: "tech" },
  { id: "preferrednetworks", label: "Preferred Networks", category: "ai" },
  { id: "type", label: "TYPE (Japan)", category: "tech" },
  { id: "klab", label: "KLab", category: "game" },
  { id: "gree", label: "GREE", category: "game" },
  { id: "dena", label: "DeNA", category: "game" },
  // ── 欧洲 / 其他 ──
  { id: "klarna", label: "Klarna", category: "tech" },
  { id: "deliveryhero", label: "Delivery Hero", category: "tech" },
  { id: "zalando", label: "Zalando", category: "tech" },
  { id: "sap", label: "SAP", category: "tech" },
  { id: "nokia", label: "Nokia", category: "tech" },
  { id: "ericsson", label: "Ericsson", category: "tech" },
  { id: "booking", label: "Booking.com", category: "tech" },
  { id: "revolut", label: "Revolut", category: "tech" },
  { id: "wise", label: "Wise", category: "tech" },
  { id: "checkr", label: "Checkr", category: "tech" },
];

const GHG = (s: string) => `https://boards-api.greenhouse.io/v1/boards/${s}/jobs?content=false`;
const ASHBY = (o: string) => `https://api.ashbyhq.com/posting-api/job-board/${o}`;

async function countGh(s: string): Promise<number> {
  try {
    const r = await fetch(GHG(s), { signal: AbortSignal.timeout(12_000) });
    if (!r.ok) return -1;
    const d = (await r.json()) as { jobs?: unknown[] };
    return (d.jobs ?? []).length;
  } catch {
    return -1;
  }
}
async function countAshby(o: string): Promise<number> {
  try {
    const r = await fetch(ASHBY(o), { signal: AbortSignal.timeout(12_000) });
    if (!r.ok) return -1;
    const d = (await r.json()) as { jobs?: Array<{ isListed?: boolean }> };
    return (d.jobs ?? []).filter((j) => j.isListed !== false).length;
  } catch {
    return -1;
  }
}

interface Hit { id: string; label: string; category: Cat; kind: "greenhouse" | "ashby"; count: number }

async function probe(c: Cand): Promise<Hit | null> {
  const gh = await countGh(c.id);
  if (gh > 0) return { ...c, kind: "greenhouse", count: gh };
  const ab = await countAshby(c.id);
  if (ab > 0) return { ...c, kind: "ashby", count: ab };
  return null;
}

// 简单并发池
async function pool<T, R>(items: T[], worker: (t: T) => Promise<R>, size = 10): Promise<R[]> {
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
  console.log(`探测 ${CANDIDATES.length} 个候选（双端：Greenhouse + Ashby）…\n`);
  const res = await pool(CANDIDATES, probe, 10);
  const hits = res.filter(Boolean) as Hit[];
  const okIds = new Set(hits.map((h) => h.id));

  console.log(`=== OK: ${hits.length}/${CANDIDATES.length} ===`);
  for (const h of hits.sort((a, b) => b.count - a.count)) {
    console.log(`OK\t${h.id}\t${h.kind}\t${h.category}\t${h.label}\t${h.count}`);
  }
  const fails = CANDIDATES.filter((c) => !okIds.has(c.id));
  console.log(`\n=== FAIL: ${fails.length} ===`);
  for (const c of fails) console.log(`FAIL\t${c.id}\t${c.label}`);
  process.exit(0);
})();
