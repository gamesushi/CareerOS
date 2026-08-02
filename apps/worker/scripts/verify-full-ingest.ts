// 验证"抓取全量岗位"改造：直接调用各来源的 search("")（空关键词=全量），
// 打印返回岗位数，确认 cap 已放开 / 分页已生效。
// 仅导入纯 fetch 类适配器，不触碰 Playwright 模块，避免 OOM。
import { makeGreenhouseSource } from "../src/sources/greenhouse";
import { makeAshbySource } from "../src/sources/ashby";
import { makeLeverSource } from "../src/sources/lever";
import { remoteokSource } from "../src/sources/remoteok";
import { tencentSource } from "../src/sources/tencent";
import { bytedanceSource } from "../src/sources/bytedance";
import { wantedlySource } from "../src/sources/wantedly";

// 用工厂函数构造轻量测试来源（不依赖 index.ts / finance.ts）
const TESTS: { id: string; src: any }[] = [
  { id: "netease(greenhouse)", src: makeGreenhouseSource({ id: "netease", label: "网易游戏", board: "neteasegames", category: "game" }) },
  { id: "riotgames(greenhouse)", src: makeGreenhouseSource({ id: "riotgames", label: "Riot", board: "riotgames", category: "game" }) },
  { id: "nintendo(greenhouse)", src: makeGreenhouseSource({ id: "nintendo", label: "Nintendo", board: "nintendo", category: "game" }) },
  { id: "epicgames(greenhouse)", src: makeGreenhouseSource({ id: "epicgames", label: "Epic", board: "epicgames", category: "game" }) },
  { id: "openai(ashby)", src: makeAshbySource({ id: "openai", label: "OpenAI", org: "openai", category: "ai" }) },
  { id: "cohere(ashby)", src: makeAshbySource({ id: "cohere", label: "Cohere", org: "cohere", category: "ai" }) },
  { id: "perplexity(ashby)", src: makeAshbySource({ id: "perplexity", label: "Perplexity", org: "perplexity", category: "ai" }) },
  { id: "cursor(ashby)", src: makeAshbySource({ id: "cursor", label: "Cursor", org: "cursor", category: "ai" }) },
  { id: "spotify(lever)", src: makeLeverSource({ id: "spotify", label: "Spotify", company: "spotify" }) },
  { id: "binance(lever)", src: makeLeverSource({ id: "binance", label: "Binance", company: "binance", category: "finance" }) },
  { id: "remoteok", src: remoteokSource },
  { id: "tencent", src: tencentSource },
  { id: "bytedance", src: bytedanceSource },
  { id: "wantedly", src: wantedlySource },
];

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const to = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(`${label} 超时 ${ms}ms`)), ms); });
  try { return await Promise.race([p, to]); } finally { clearTimeout(t!); }
}

async function main() {
  let total = 0;
  for (const { id, src } of TESTS) {
    try {
      const jobs = await withTimeout(src.search(""), 30_000, id);
      total += jobs.length;
      console.log(`${id.padEnd(22)} ${String(jobs.length).padStart(5)} 条`);
    } catch (e) {
      console.log(`${id.padEnd(22)} 错误: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\n合计（纯 fetch 类抽样）: ${total} 条`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
