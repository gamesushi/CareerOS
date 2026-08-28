import type { JobSource, SourceJob } from "./types";
import { withBrowser, waitForAny } from "./lib/headless";

// Indeed 搜索结果页（JS 重渲染 + Cloudflare/AWS 强反爬）。
// 裸 fetch 一律返回 403 挑战页，必须执行 JS、带真实浏览器指纹才能拿到真实 DOM。
// 因此改为 worker 侧 Playwright headless 渲染后抽取职位卡片。
//
// 失败语义（graceful，不污染监测）：
// - 命中反爬拦截页 / 无卡片 / 浏览器异常 → 返回空数组 + console.warn，不抛错。

export interface IndeedScrapeOpts {
  /** 站点主机，如 "jp.indeed.com"（日本）或 "www.indeed.com"（国际/美国） */
  host: string;
  /** 浏览器 locale，影响语言与地区内容 */
  locale: string;
  /** 日志标识 */
  label: string;
  /** externalId 前缀，避免 JP 站与全球站的 jk 撞车 */
  prefix: string;
}

type RawCard = {
  jk: string;
  title: string;
  company: string;
  loc: string;
  href: string;
};

/** 反爬挑战页 / 拦截页的可见文案特征 */
const BLOCK_PATTERN =
  "checking if you are a human|just a moment|enable javascript and cookies|are you a human|verify you are human";

/** 职位卡片选择器（新旧版 DOM 都覆盖） */
const CARD_SELECTORS = ["div[data-testid='jobListing']", "a[data-jk]"];

/**
 * 用 worker 侧 Playwright headless 渲染 Indeed 搜索结果页，抽取职位卡片。
 * 命中拦截页、无结果或浏览器异常时返回空数组。
 */
export async function scrapeIndeed(
  opts: IndeedScrapeOpts,
  keyword: string,
): Promise<SourceJob[]> {
  const url = `https://${opts.host}/jobs?q=${encodeURIComponent(keyword)}&l=`;
  try {
    return await withBrowser(
      async ({ page }) => {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
        const hit = await waitForAny(page, CARD_SELECTORS, 15_000).catch(() => null);

        const blocked = await page
          .evaluate((p) => {
            const re = new RegExp(p, "i");
            return re.test(document.body?.innerText || "");
          }, BLOCK_PATTERN)
          .catch(() => false);
        if (blocked) {
          console.warn(`[indeed:${opts.label}] anti-bot challenge detected, returning empty`);
          return [];
        }
        if (!hit) {
          console.warn(`[indeed:${opts.label}] no job cards rendered, returning empty`);
          return [];
        }

        // 卡片骨架出现后稍等，让公司/地点等惰性内容补齐
        await page.waitForTimeout(800).catch(() => {});

        const raw = await page
          .evaluate(() => {
            const out: RawCard[] = [];
            const seen = new Set<string>();
            const cards = Array.from(
              document.querySelectorAll("div[data-testid='jobListing'], a[data-jk]"),
            ) as HTMLElement[];
            for (const el of cards) {
              const link = (
                el.matches("a[data-jk]") ? el : el.querySelector("a[data-jk]")
              ) as HTMLAnchorElement | null;
              if (!link) continue;
              const jk = link.getAttribute("data-jk");
              if (!jk || seen.has(jk)) continue;
              const titleEl = link.querySelector("span") || link;
              const title = (titleEl.textContent || "").trim();
              if (!title) continue;
              const root = (el.closest("div[data-testid='jobListing']") ||
                el.parentElement ||
                el) as HTMLElement;
              const company =
                root
                  .querySelector(
                    "[data-testid='companyName'], span.companyName, [class*='companyName']",
                  )
                  ?.textContent?.trim() || "";
              const loc =
                root
                  .querySelector(
                    "[data-testid='text-location'], div.companyLocation, [class*='companyLocation']",
                  )
                  ?.textContent?.trim() || "";
              seen.add(jk);
              out.push({ jk, title, company, loc, href: link.getAttribute("href") || "" });
              if (out.length >= 25) break;
            }
            return out;
          })
          .catch(() => [] as RawCard[]);

        return raw.map((r) => ({
          externalId: `${opts.prefix}-${r.jk}`,
          title: r.title,
          company: r.company || undefined,
          location: r.loc || undefined,
          url: r.href.startsWith("http") ? r.href : `https://${opts.host}${r.href}`,
          raw: { jk: r.jk },
        }));
      },
      { locale: opts.locale },
    );
  } catch (e) {
    console.warn(`[indeed:${opts.label}] scrape failed: ${(e as Error).message}`);
    return [];
  }
}

// Indeed 日本站（jp.indeed.com）
export const indeedSource: JobSource = {
  id: "indeed",
  label: "Indeed 日本",
  async search(keyword: string): Promise<SourceJob[]> {
    return scrapeIndeed(
      { host: "jp.indeed.com", locale: "ja-JP", label: "jp", prefix: "indeed" },
      keyword,
    );
  },
};
