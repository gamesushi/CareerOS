// 探查中文招聘平台（拉勾/51job/智联/牛客）的搜索 JSON 接口。
// 加载搜索页 → 拦截 content-type=json 的响应 → 过滤出含岗位结构的 → 打印 URL + 结构。
import { withBrowser } from "../src/sources/lib/headless";

type Cand = { id: string; url: string };

const CANDIDATES: Cand[] = [
  { id: "lagou", url: "https://www.lagou.com/jobs/list_%E6%B8%B8%E6%88%8F?city=%E5%85%A8%E5%9B%BD" },
  { id: "lagou2", url: "https://www.lagou.com/wn/jobs?kx=%E6%B8%B8%E6%88%8F" },
  { id: "job51", url: "https://search.51job.com/list/000000,000000,0000,00,9,99,%E6%B8%B8%E6%88%8F,2,1.html" },
  { id: "zhaopin", url: "https://sou.zhaopin.com/?kw=%E6%B8%B8%E6%88%8F&cityId=765" },
  { id: "nowcoder", url: "https://www.nowcoder.com/job?jobType=1&keyword=%E6%B8%B8%E6%88%8F" },
];

const JOB_HINT = /"title"|"jobName"|"jobTitle"|"positionName"|"postName"|"jobId"|"positionId"|"companyName"|"compName"|"jobcard"|"jobList"|"result"|"list"/i;

async function main() {
  for (const c of CANDIDATES) {
    console.log(`\n========== ${c.id}  (${c.url}) ==========`);
    try {
      await withBrowser(async ({ page, goto }) => {
        const hits: { url: string; snippet: string }[] = [];
        page.on("response", async (resp) => {
          const ct = resp.headers()["content-type"] ?? "";
          if (!/json/.test(ct)) return;
          try {
            const txt = await resp.text();
            if (txt.length < 80) return;
            if (!JOB_HINT.test(txt)) return;
            hits.push({ url: resp.url(), snippet: txt.slice(0, 260).replace(/\s+/g, " ") });
          } catch {
            /* ignore */
          }
        });
        await goto(c.url, { timeout: 20000 }).catch(() => {});
        await page.mouse.wheel(0, 1200).catch(() => {});
        await page.waitForTimeout(4000);
        if (hits.length === 0) {
          console.log("  (no job JSON API captured)");
          return;
        }
        const seen = new Set<string>();
        for (const h of hits) {
          const k = h.url.replace(/\?.*$/, "");
          if (seen.has(k)) continue;
          seen.add(k);
          console.log(`  API: ${h.url}`);
          console.log(`    ${h.snippet}`);
          if (seen.size >= 5) break;
        }
      });
    } catch (e) {
      console.log("  ERROR:", (e as Error).message?.slice(0, 200));
    }
  }
}
void main();
