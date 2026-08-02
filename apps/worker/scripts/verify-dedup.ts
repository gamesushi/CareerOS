// 量化证明去重：复刻 watchPoll 的整板缓存分支，用真实 fetchAll 方法 + 全局 fetch 计数器。
// 不导入 index.ts（避免 playwright OOM），直接 import HARVESTED（安全）。
import { HARVESTED } from "../src/sources/harvested";

// 包裹 global fetch 计数
let fetchCount = 0;
const origFetch = globalThis.fetch;
(globalThis.fetch as any) = (...args: any[]) => {
  fetchCount++;
  return (origFetch as any)(...args);
};

type SourceJob = { externalId: string; title?: string; snippet?: string | null };
type JobSource = { id: string; fetchAll?: () => Promise<SourceJob[]>; search: (k: string) => Promise<SourceJob[]> };

async function main() {
  // 从 harvested 选 4 个 greenhouse/ashby/lever 来源
  const ids = Object.keys(HARVESTED).slice(0, 4);
  const sources = ids.map((id) => HARVESTED[id] as unknown as JobSource);
  const keywords = ["", "engineer", "python", "data", "go"]; // 5 个关键词

  const boardCache = new Map<string, SourceJob[]>();
  let stored = 0;
  for (const source of sources) {
    for (const keyword of keywords) {
      let jobs: SourceJob[];
      if (source.fetchAll) {
        if (!boardCache.has(source.id)) {
          boardCache.set(source.id, await source.fetchAll!());
        }
        jobs = boardCache.get(source.id)!;
      } else {
        jobs = await source.search(keyword);
      }
      const kw = keyword.trim().toLowerCase();
      const matched = kw ? jobs.filter((j) => `${j.title ?? ""} ${j.snippet ?? ""}`.toLowerCase().includes(kw)) : jobs;
      stored += matched.length;
    }
  }

  console.log(`来源数=${sources.length}  关键词数=${keywords.length}`);
  console.log(`实际网络抓取次数(fetch count)=${fetchCount}  （无去重应为 ${sources.length * keywords.length}）`);
  console.log(`去重效果: ${fetchCount} 次 vs ${sources.length * keywords.length} 次 = 减少 ${100 - Math.round((fetchCount / (sources.length * keywords.length)) * 100)}%`);
  console.log(`匹配岗位累计入库数=${stored}`);
  process.exit(fetchCount === sources.length ? 0 : 2);
}

main();
