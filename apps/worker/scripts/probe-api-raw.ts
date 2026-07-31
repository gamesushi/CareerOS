// 原始探查：加载页面，捕获所有含 /api/ 或 api./gw. 的响应，原样打印 URL + 响应体前 500 字，
// 用于发现真实岗位接口（不靠 body 内容猜测）。
import { withBrowser } from "../src/sources/lib/headless";

type Cand = { id: string; url: string; scroll?: boolean };

const CANDIDATES: Cand[] = [
  { id: "nowcoder", url: "https://www.nowcoder.com/job?jobType=1&keyword=%E6%B8%B8%E6%88%8F" },
  { id: "findy", url: "https://findy.jp/jobs?keyword=game" },
  { id: "findy2", url: "https://findy.jp/jobs" },
  { id: "job51", url: "https://search.51job.com/list/000000,000000,0000,00,9,99,%E6%B8%B8%E6%88%8F,2,1.html" },
  { id: "lagou", url: "https://www.lagou.com/jobs/list_%E6%B8%B8%E6%88%8F" },
  { id: "lagou3", url: "https://www.lagou.com/wn/jobs?kx=%E6%B8%B8%E6%88%8F" },
];

async function main() {
  for (const c of CANDIDATES) {
    console.log(`\n========== ${c.id}  (${c.url}) ==========`);
    try {
      await withBrowser(async ({ page, goto }) => {
        const hits: { url: string; body: string }[] = [];
        page.on("response", async (resp) => {
          const u = resp.url();
          if (!/\/api\/|api\.|gw\.|\.json/.test(u)) return;
          try {
            const txt = await resp.text();
            if (txt.length < 60) return;
            hits.push({ url: u, body: txt.slice(0, 480).replace(/\s+/g, " ") });
          } catch {
            /* ignore */
          }
        });
        await goto(c.url, { timeout: 20000 }).catch(() => {});
        await page.mouse.wheel(0, 1500).catch(() => {});
        await page.waitForTimeout(4500);
        if (hits.length === 0) {
          console.log("  (no /api/ response captured)");
          return;
        }
        const seen = new Set<string>();
        for (const h of hits) {
          const k = h.url.replace(/\?.*$/, "").slice(0, 90);
          if (seen.has(k)) continue;
          seen.add(k);
          console.log(`  API: ${h.url}`);
          console.log(`    ${h.body}`);
          if (seen.size >= 8) break;
        }
      });
    } catch (e) {
      console.log("  ERROR:", (e as Error).message?.slice(0, 200));
    }
  }
}
void main();
