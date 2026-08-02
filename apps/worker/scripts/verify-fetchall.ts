// 验证整板型适配器的 fetchAll/search 行为（不依赖 playwright，安全直跑）。
import { HARVESTED } from "../src/sources/harvested";
import { makeGreenhouseSource } from "../src/sources/greenhouse";
import { makeAshbySource } from "../src/sources/ashby";
import { makeLeverSource } from "../src/sources/lever";

async function main() {
  // 用已知点 + 几个 harvested 来源抽样
  const gh = makeGreenhouseSource({ id: "netease", label: "网易游戏", board: "neteasegames", category: "game" });
  const ab = makeAshbySource({ id: "openai", label: "OpenAI", org: "openai", category: "ai" });
  const lv = makeLeverSource({ id: "spotify", label: "Spotify", company: "spotify" });

  const samples = [gh, ab, lv];
  // 从 harvested 里挑 2 个 greenhouse + 1 个 ashby + 1 个 lever
  const harvIds = Object.keys(HARVESTED);
  const pick = (kind: string) => harvIds.find((id) => (HARVESTED[id] as any).fetchAll && id); // 占位
  void pick;
  const extra: any[] = [];
  let g = 0, a = 0, l = 0;
  for (const id of harvIds) {
    const s = HARVESTED[id] as any;
    if (!s.fetchAll) continue;
    if (g < 1 && id.length > 0) { extra.push(s); g++; }
    else if (a < 1) { extra.push(s); a++; }
    else if (l < 1) { extra.push(s); l++; }
    if (g && a && l) break;
  }

  const all = [...samples, ...extra] as any[];
  let ok = 0, fail = 0;
  for (const s of all) {
    try {
      const board = await s.fetchAll!();
      const kw = "engineer";
      const filtered = await s.search(kw);
      const hasFetchAll = typeof s.fetchAll === "function";
      const boardHasTitle = board.every((j: any) => typeof j.title === "string");
      const filteredAllInBoard = filtered.every((j: any) =>
        board.some((b: any) => b.externalId === j.externalId),
      );
      const filteredMatchesKw = filtered.every((j: any) =>
        `${j.title ?? ""}`.toLowerCase().includes(kw),
      );
      console.log(
        `  ${s.id.padEnd(16)} fetchAll=${hasFetchAll} board=${board.length} search("${kw}")=${filtered.length} ` +
          `titleOK=${boardHasTitle} subsetOK=${filteredAllInBoard} kwOK=${filteredMatchesKw}`,
      );
      if (hasFetchAll && boardHasTitle && filteredAllInBoard && filteredMatchesKw) ok++;
      else fail++;
    } catch (e) {
      console.log(`  ${s.id.padEnd(16)} ERROR: ${e instanceof Error ? e.message : String(e)}`);
      fail++;
    }
  }
  console.log(`\n结果: ${ok} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
}

main();
