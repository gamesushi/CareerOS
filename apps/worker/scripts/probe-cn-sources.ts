// 探查脚本：对一批中文招聘站用真实无头浏览器渲染，
// 拦截前端调用的 JSON 接口，打印候选 API URL + 采样 body，
// 用于据此编写 makeCnApiSource 适配器配置。
// 用法：在 apps/worker 下
//   HTTP_PROXY= HTTPS_PROXY= NO_PROXY=localhost,127.0.0.1 \
//     ../../worker/node_modules/.bin/tsx --env-file=../../.env scripts/probe-cn-sources.ts
import { withBrowser } from "../src/sources/lib/headless";

type Cand = { id: string; url: string };

const CANDIDATES: Cand[] = [
  // 中国游戏（中型，自有招聘板）
  { id: "lilith", url: "https://jobs.lilith.com/" },
  { id: "ark", url: "https://www.yjyx.com/" },
  { id: "papergames", url: "https://www.papergames.com.cn/" },
  { id: "xd", url: "https://www.xd.com/careers" },
  { id: "zlong", url: "https://www.zlonggame.com/" },
  { id: "leihuo", url: "https://www.leihuo.com.cn/" },
  { id: "y37", url: "https://www.37.com/" },
  { id: "pw", url: "https://www.pwrte.com/" },
  // 中国金融：券商
  { id: "citics", url: "https://career.citics.com/" },
  { id: "htsc", url: "https://www.htsc.com.cn/" },
  { id: "cicc", url: "https://www.cicc.com/" },
  { id: "gf", url: "https://www.gf.com.cn/" },
  { id: "gtja", url: "https://www.gtja.com/" },
  { id: "swh", url: "https://www.swhysc.com/" },
  { id: "orient", url: "https://www.orientsec.com.cn/" },
  // 中国金融：基金
  { id: "chinaamc", url: "https://www.chinaamc.com/" },
  { id: "harvest", url: "https://www.harvestasset.cn/" },
  { id: "southern", url: "https://www.southernfund.com/" },
  { id: "bosera", url: "https://www.bosera.com/" },
  { id: "jiujiufund", url: "https://www.99fund.com/" },
  { id: "gfund", url: "https://www.gfund.com/" },
  { id: "fullgoal", url: "https://www.fullgoal.com.cn/" },
  { id: "zoa", url: "https://www.zoacap.com/" },
  { id: "yhfund", url: "https://www.yhfund.com.cn/" },
];

async function main() {
  for (const c of CANDIDATES) {
    console.log(`\n========== ${c.id}  (${c.url}) ==========`);
    try {
      await withBrowser(async ({ page, goto }) => {
        const apis: { url: string; len: number; sample: string }[] = [];
        page.on("response", async (resp) => {
          const u = resp.url();
          const ct = resp.headers()["content-type"] ?? "";
          if (!/json|javascript/.test(ct) && !/\/api\/|vacanc|position|job|recruit|zhaopin/i.test(u)) return;
          try {
            const txt = await resp.text();
            if (txt.length < 40) return;
            if (!/\[|\{/.test(txt)) return;
            apis.push({ url: u, len: txt.length, sample: txt.slice(0, 400) });
          } catch {
            /* ignore */
          }
        });
        await goto(c.url, { timeout: 20000 }).catch(() => {});
        // 触发可能的懒加载
        await page.mouse.wheel(0, 1500).catch(() => {});
        await page.waitForTimeout(3500);
        if (apis.length === 0) {
          console.log("  (no JSON API captured)");
          return;
        }
        // 去重，按 body 长度降序取前 6
        const seen = new Set<string>();
        const uniq = apis.filter((a) => {
          const k = a.url.replace(/\?.*$/, "");
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        uniq
          .sort((a, b) => b.len - a.len)
          .slice(0, 6)
          .forEach((a) => {
            console.log(`  API len=${a.len}`);
            console.log(`    ${a.url}`);
            console.log(`    sample: ${a.sample.replace(/\s+/g, " ")}`);
          });
      });
    } catch (e) {
      console.log("  ERROR:", (e as Error).message?.slice(0, 200));
    }
  }
}
void main();
