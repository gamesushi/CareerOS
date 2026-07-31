// 聚焦探查牛客岗位搜索接口：模拟在搜索框输入关键词并回车，捕获职位 JSON 接口。
import { withBrowser } from "../src/sources/lib/headless";

async function main() {
  const kw = "游戏";
  console.log(`===== nowcoder search "${kw}" =====`);
  await withBrowser(async ({ page, goto }) => {
    const hits: { url: string; body: string }[] = [];
    page.on("response", async (resp) => {
      const u = resp.url();
      if (!/\/api\//.test(u)) return;
      try {
        const txt = await resp.text();
        if (txt.length < 60) return;
        if (!/job|position|recruit|招聘|职位/.test(u) && !/jobId|jobName|jobTitle|positionName|companyName|postName/.test(txt)) return;
        hits.push({ url: u, body: txt.slice(0, 600).replace(/\s+/g, " ") });
      } catch {
        /* ignore */
      }
    });
    await goto("https://www.nowcoder.com/job", { timeout: 20000 }).catch(() => {});
    // 找搜索框并输入回车
    const sel = 'input[placeholder*="公司"], input[placeholder*="职位"], input[placeholder*="搜索"], input[type="text"]';
    const box = await page.$(sel).catch(() => null);
    if (box) {
      await box.click({ timeout: 3000 }).catch(() => {});
      await box.fill(kw, { timeout: 3000 }).catch(() => {});
      await box.press("Enter", { timeout: 3000 }).catch(() => {});
      console.log("  filled search box + Enter");
    } else {
      console.log("  no search box found");
    }
    await page.waitForTimeout(5000);
    if (hits.length === 0) {
      console.log("  (no job API captured after search)");
      return;
    }
    const seen = new Set<string>();
    for (const h of hits) {
      const k = h.url.replace(/\?.*$/, "").slice(0, 100);
      if (seen.has(k)) continue;
      seen.add(k);
      console.log(`  API: ${h.url}`);
      console.log(`    ${h.body}`);
      if (seen.size >= 6) break;
    }
  });
}
void main();
