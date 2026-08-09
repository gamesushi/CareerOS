import type { JobSource, SourceJob } from "./types";
import { deriveCategories } from "./lib/category";
import { withBrowser } from "./lib/headless";

// 库洛游戏（KURO GAMES，鸣潮/战双帕弥什开发商）招聘。
// 走飞书招聘 SaaS（kurogame.jobs.feishu.cn）。岗位数据由前端 JS 渲染，
// 来自 XHR 接口 POST /api/v1/search/job/posts（带 _signature，必须浏览器上下文）。
// 与米哈游/平安/招行同理：用 withBrowser 加载列表页，拦截该接口响应收集岗位。
// 校招 portal_type=6；飞书校招列表是「点击式分页器」（非无限滚动），
// 分页器文本形如「首页 1 2 尾页」，需逐页点击页码才能抓全。

const KURO_FEED = "https://kurogame.jobs.feishu.cn/campus/position/list";

function mapKuroJob(j: any): SourceJob {
  const title = (j.title ?? "(untitled)").trim();
  const city = Array.isArray(j.city_list)
    ? j.city_list.map((c: any) => c.name).filter(Boolean).join(" · ")
    : undefined;
  const func = j.job_function?.name;
  const text = `${title} ${func ?? ""} ${city ?? ""}`;
  const id = String(j.id);
  return {
    externalId: `kuro-${id}`,
    title,
    company: "库洛游戏",
    location: city || undefined,
    url: `https://kurogame.jobs.feishu.cn/campus/position/${id}/detail`,
    snippet: `${j.description ?? ""} ${j.requirement ?? ""}`.slice(0, 500).trim(),
    publishedAt: j.publish_time ? new Date(j.publish_time) : undefined,
    categories: deriveCategories(text, "game"),
    raw: j,
  };
}

export const kuroSource: JobSource = {
  id: "kuro",
  label: "库洛游戏",
  category: "game",
  // 整板抓取型：忽略关键词，一次轮询内按来源缓存，返回全量在招岗位。
  async search(): Promise<SourceJob[]> {
    return withBrowser(async ({ page, goto }) => {
      const collected: any[] = [];
      const pending: Promise<void>[] = [];
      // 监听飞书岗位接口响应，收集每一页的岗位列表。
      // 必须在 goto 之前挂上，保证首屏那次 XHR 不丢。
      const onResp = (r: any) => {
        const u = r.url();
        if (
          u.includes("/api/v1/search/job/posts") &&
          r.request().method() === "POST" &&
          r.status() === 200
        ) {
          pending.push(
            r
              .json()
              .then((j: any) => {
                const list = j?.data?.job_post_list;
                if (Array.isArray(list)) collected.push(...list);
              })
              .catch(() => {}),
          );
        }
      };
      page.on("response", onResp);

      await goto(KURO_FEED);
      // 首屏默认加载第 1 页，等响应落库
      await page.waitForTimeout(2500);
      await Promise.all(pending).catch(() => {});
      pending.length = 0;

      // 飞书校招列表是「点击式分页器」：探测最大页码，逐页点击抓取。
      // 用字符串式 evaluate（避免 tsx 注入 __name 导致的 ReferenceError）。
      const maxPage: number = await page
        .evaluate(
          `(() => {
            try {
              var pager = document.querySelector('.pagination,[class*="pagination"],[class*="pager"],[class*="Pagination"]') || document.body;
              var txt = pager.innerText || "";
              var nums = (txt.match(/\\d+/g) || []).map(Number);
              var cand = nums.filter(function(n){ return n >= 2 && n <= 200; });
              return cand.length ? Math.max.apply(null, cand) : 1;
            } catch (e) { return 1; }
          })()`,
        )
        .catch(() => 1) as number;

      for (let p = 2; p <= maxPage; p++) {
        const clicked: boolean = await page
          .evaluate(
            `(() => {
              try {
                var pager = document.querySelector('.pagination,[class*="pagination"],[class*="pager"],[class*="Pagination"]') || document.body;
                var els = Array.prototype.slice.call(pager.querySelectorAll('a,button'));
                var target = els.find(function(e){ return e.textContent && e.textContent.trim() === String(${p}); });
                if (target && !target.classList.contains('is-active') && target.getAttribute('aria-current') !== 'page') {
                  target.click();
                  return true;
                }
                return false;
              } catch (e) { return false; }
            })()`,
          )
          .catch(() => false) as boolean;
        if (!clicked) break;
        await page.waitForTimeout(2500);
        await Promise.all(pending).catch(() => {});
        pending.length = 0;
      }

      // 按 id 去重
      const seen = new Set<string>();
      const uniq = collected.filter((j) => {
        const id = String(j.id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      return uniq.map(mapKuroJob);
    });
  },
};
