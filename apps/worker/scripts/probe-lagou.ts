// 聚焦探查拉勾岗位接口：加载搜索页建立 cookie/referer，再 POST positionAjax.json。
import { withBrowser } from "../src/sources/lib/headless";

async function main() {
  const kw = "游戏";
  console.log(`===== lagou search "${kw}" (positionAjax.json POST) =====`);
  await withBrowser(async ({ page, goto }) => {
    const ref = `https://www.lagou.com/jobs/list_${encodeURIComponent(kw)}?city=%E5%85%A8%E5%9B%BD`;
    await goto(ref, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const json = await page
      .evaluate(
        async ({ kw, ref }) => {
          const body = new URLSearchParams({
            first: "true",
            pn: "1",
            kd: kw,
            sid: "",
          }).toString();
          const r = await fetch("https://www.lagou.com/jobs/positionAjax.json", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              Referer: ref,
              "X-Requested-With": "XMLHttpRequest",
            },
            body,
          });
          return r.json().catch(() => null);
        },
        { kw, ref },
      )
      .catch(() => null);
    if (!json) {
      console.log("  (no json)");
      return;
    }
    console.log("  top-level keys:", Object.keys(json).join(","));
    console.log("  snippet:", JSON.stringify(json).slice(0, 700).replace(/\s+/g, " "));
    const list: any[] = json?.content?.positionResult?.result ?? json?.content?.result ?? json?.result ?? [];
    console.log("  list len:", list.length);
    if (list[0]) {
      console.log("  sample keys:", Object.keys(list[0]).join(","));
      console.log("  sample:", JSON.stringify(list[0]).slice(0, 400));
    }
  });
}
void main();
