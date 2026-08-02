import type { JobSource, SourceJob } from "./types";
import { deriveCategories } from "./lib/category";
import { withBrowser } from "./lib/headless";

// 米哈游招聘官网（jobs.mihoyo.com）— 自研 ATS（网关 ats.openout.mihoyo.com/ats-portal）。
// 历史：纯服务端 POST /v1/job/list 有 WAF / 请求签名校验，偶发参数校验失败，纯 fetch 不稳定。
// 现方案：用 Playwright 无头浏览器加载社招页，点击职位分类展开真实职位列表（DOM 渲染），
// 抽取 .jobName 标题与地点。详情页为前端路由（无静态 href），统一回链到社招列表页。

const BASE = "https://jobs.mihoyo.com/social";

// 整板抓取型：忽略关键词，返回社招页全部职位。search 与 fetchAll 复用同一逻辑。
const mihoyoFetchAll = async (): Promise<SourceJob[]> => {
  return withBrowser(async ({ page, goto }) => {
    await goto(BASE);
    await page.waitForTimeout(2500);

    // 分类卡片（含「共N个职位」文案），逐个点击以展开各分类下的职位。
    // 默认展示首屏分类，点击进入后抽取该分类下的职位（去重累计）。
    const seen = new Set<string>();
    const jobs: SourceJob[] = [];
    const MAX_CATS = 8;
    for (let i = 0; i < MAX_CATS; i++) {
      const handles = await page.$$('[class*="jobItem___"]');
      const cats = (
        await Promise.all(
          handles.map(async (h) =>
            ((await h.innerText().catch(() => "")) || "").includes("共") ? h : null,
          ),
        )
      ).filter(Boolean) as typeof handles;
      if (i >= cats.length) break;
      await cats[i].click().catch(() => {});
      await page.waitForTimeout(2000);
      const items = await page.$$eval(
        '[class*="jobItem___"]',
        (els) =>
          els
            .map((el) => {
              const nameEl = el.querySelector('[class*="jobName___"]');
              if (!nameEl) return null;
              const a = el.closest("a");
              return {
                title: (nameEl.textContent || "").trim(),
                href: a ? a.getAttribute("href") || "" : "",
                text: (el.textContent || "").replace(/\s+/g, " ").trim(),
              };
            })
            .filter(Boolean) as { title: string; href: string; text: string }[],
      );
      for (const it of items) {
        if (!it.title || seen.has(it.title)) continue;
        seen.add(it.title);
        const locM = it.text.match(/(北京|上海|广州|深圳|杭州|成都|南京|武汉|西安|苏州|新加坡|美国|加拿大|日本|[\u4e00-\u9fa5]{2,6}?市)/);
        const url = it.href
          ? it.href.startsWith("http")
            ? it.href
            : `https://jobs.mihoyo.com${it.href}`
          : BASE;
        jobs.push({
          externalId: `mihoyo-${it.title}`,
          title: it.title,
          company: "米哈游",
          location: locM?.[1],
          url,
          categories: deriveCategories(`${it.title} ${it.text}`, "game"),
          raw: it,
        });
      }
    }
    return jobs;
  });
};

export const mihoyoSource: JobSource = {
  id: "mihoyo",
  label: "米哈游",
  category: "game",
  fetchAll: mihoyoFetchAll,
  search: mihoyoFetchAll,
};
