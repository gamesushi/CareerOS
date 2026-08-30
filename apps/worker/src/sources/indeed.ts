import type { Page } from "playwright";
import type { JobSource, SourceJob } from "./types";
import { withBrowser, waitForAny } from "./lib/headless";

// Indeed 搜索结果页（JS 重渲染 + Cloudflare/AWS 强反爬）。
// 裸 fetch 一律返回 403 挑战页，必须执行 JS、带真实浏览器指纹才能拿到真实 DOM。
// 因此改为 worker 侧 Playwright headless 渲染后抽取职位卡片。
//
// 失败语义（graceful，不污染监测）：
// - 命中反爬拦截页 / 无卡片 / 浏览器异常 → 返回空数组 + console.warn，不抛错。
//
// 翻页：scrapeIndeed 在单个浏览器会话内循环 start=0,10,20…，跨页按 jk 去重，
// 命中反爬或末页无新卡片即提前停止。单关键词覆盖从 1 页 ≤25 条 → 最多 ~INDEED_MAX_PAGES 页。

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

export interface IndeedScrapeExtra {
  /** 翻页上限（每页 ~10-15 条），默认 INDEED_MAX_PAGES */
  maxPages?: number;
}

type RawCard = {
  jk: string;
  title: string;
  company: string;
  loc: string;
  salary: string;
  snippet: string;
  href: string;
};

/** 翻页上限：单关键词最多抓多少页（≈ 覆盖量 = 页数 × 每页条数）。可调。 */
const INDEED_MAX_PAGES = 8;
/** 单次抓取总量硬上限，避免极端情况下失控入库。 */
const INDEED_MAX_TOTAL = 200;
/** 翻页之间的礼貌间隔，降低被反爬的概率。 */
const INDEED_PAGE_DELAY_MS = 1500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 反爬挑战页 / 拦截页的可见文案特征 */
const BLOCK_PATTERN =
  "checking if you are a human|just a moment|enable javascript and cookies|are you a human|verify you are human|additional verification required";

/**
 * 是否命中拦截页。
 * 注意：evaluate 回调内不能定义任何函数（esbuild keepNames 会注入 __name 导致
 * ReferenceError），这里直接内联表达式。
 */
async function isBlocked(page: Page): Promise<boolean> {
  return page
    .evaluate(
      (p) => new RegExp(p, "i").test(document.body?.innerText || ""),
      BLOCK_PATTERN,
    )
    .catch(() => false);
}

/** 等待渲染的候选选择器（新旧版 DOM 都覆盖） */
const CARD_SELECTORS = [
  "div[data-testid='slider_item']",
  "div[data-testid='jobListing']",
  "a[data-jk]",
];

/**
 * Indeed 结果页会混进前端模板/示例卡片，它们同样带 data-jk，
 * 但 jk 是人工构造的规律序列（真实 jk 是随机十六进制），
 * 且内容常与真实职位重复 → 不去重就会一个岗位入库两条。
 * 实测出现过的假 jk：123456789abcdef0、a1b2c3d4e5f67890、0f1e2d3c4b5a6978。
 */
const KNOWN_TEMPLATE_JK = new Set(["123456789abcdef0", "abcdef0123456789"]);

const HEX_CHARS = "0123456789abcdef";

/** 序列中相邻差为 ±1 的比例（衡量"肉眼可读的规律递增/递减"程度） */
function monoRatio(values: number[]): number {
  if (values.length < 2) return 0;
  let mono = 0;
  for (let i = 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (d === 1 || d === -1) mono++;
  }
  return mono / (values.length - 1);
}

/** 判定 jk 是否为模板节点（非真实职位） */
function isTemplateJk(jk: string): boolean {
  const k = jk.toLowerCase();
  if (KNOWN_TEMPLATE_JK.has(k)) return true;
  const idx = Array.from(k).map((c) => HEX_CHARS.indexOf(c));
  // 非纯十六进制（站点换了 jk 规则）→ 无法判定，一律放行，宁可多抓也不错杀
  if (idx.some((i) => i < 0)) return false;
  // 整串单调：123456789abcdef0 这类
  if (monoRatio(idx) >= 0.6) return true;
  // 奇偶位两条子序列各自单调：a1b2c3d4e5f67890 / 0f1e2d3c4b5a6978 这类
  const even: number[] = [];
  const odd: number[] = [];
  idx.forEach((v, i) => (i % 2 === 0 ? even : odd).push(v));
  if (even.length >= 6 && monoRatio(even) >= 0.7 && monoRatio(odd) >= 0.7) return true;
  return false;
}

/**
 * 用 worker 侧 Playwright headless 渲染 Indeed 搜索结果页，翻页抽取职位卡片。
 * 命中拦截页、无结果或浏览器异常时返回已累积的部分结果（或空数组）。
 */
export async function scrapeIndeed(
  opts: IndeedScrapeOpts,
  keyword: string,
  extra: IndeedScrapeExtra = {},
): Promise<SourceJob[]> {
  const maxPages = extra.maxPages ?? INDEED_MAX_PAGES;
  const url0 = `https://${opts.host}/jobs?q=${encodeURIComponent(keyword)}&l=`;
  try {
    return await withBrowser(
      async ({ page }) => {
        // 跨页去重：jk → 原始卡片。保证翻页不重复入库同一岗位。
        const collected = new Map<string, RawCard>();
        let pagesFetched = 0;

        for (let pageNum = 0; pageNum < maxPages; pageNum++) {
          const url = pageNum === 0 ? url0 : `${url0}&start=${pageNum * 10}`;
          try {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
          } catch (e) {
            console.warn(`[indeed:${opts.label}] page ${pageNum} goto failed: ${(e as Error).message}`);
            break;
          }

          // 命中反爬：第 0 页提前探一次立即返回；其余页命中则停止翻页，保留已抓部分。
          await page.waitForTimeout(2_000).catch(() => {});
          if (await isBlocked(page)) {
            console.warn(`[indeed:${opts.label}] anti-bot challenge on page ${pageNum}, stopping pagination`);
            break;
          }

          const hit = await waitForAny(page, CARD_SELECTORS, 15_000).catch(() => null);
          if (await isBlocked(page)) {
            console.warn(`[indeed:${opts.label}] anti-bot challenge on page ${pageNum}, stopping pagination`);
            break;
          }
          if (!hit) {
            console.warn(`[indeed:${opts.label}] no job cards on page ${pageNum}, stopping`);
            break;
          }

          // 卡片骨架出现后稍等，让公司/地点等惰性内容补齐
          await page.waitForTimeout(800).catch(() => {});

          // 注意：page.evaluate 的回调会被序列化成字符串在浏览器里执行。
          // 切勿在回调内部定义函数/箭头函数——tsx(esbuild) 的 keepNames 会给它们注入
          // __name 辅助函数，而浏览器上下文没有 __name，整个回调会抛
          // "ReferenceError: __name is not defined" 并被下面的 catch 静默吞成空数组。
          // 因此这里所有取值逻辑一律内联展开，不抽取任何辅助函数。
          const raw = await page
            .evaluate(() => {
              const out: RawCard[] = [];
              const seen = new Set<string>();
              // 卡片根优先用整块职位容器（含公司/地点/摘要），
              // 只有连容器都找不到时才退化到 a[data-jk] 标题链接本身。
              const slider = document.querySelectorAll("div[data-testid='slider_item']");
              const listing = document.querySelectorAll("div[data-testid='jobListing']");
              let cards: HTMLElement[];
              if (slider.length > 0) cards = Array.from(slider) as HTMLElement[];
              else if (listing.length > 0) cards = Array.from(listing) as HTMLElement[];
              else cards = Array.from(document.querySelectorAll("a[data-jk]")) as HTMLElement[];

              for (const el of cards) {
                const link = (
                  el.matches("a[data-jk]") ? el : el.querySelector("a[data-jk]")
                ) as HTMLAnchorElement | null;
                if (!link) continue;
                const jk = link.getAttribute("data-jk") || "";
                if (!jk || seen.has(jk)) continue;
                // 标题优先取 span 的 title 属性（干净），否则回退文本
                const titleSpan = link.querySelector("span[title]") || link.querySelector("span");
                const title = (
                  (titleSpan && titleSpan.getAttribute("title")) ||
                  (titleSpan && titleSpan.textContent) ||
                  link.textContent ||
                  ""
                ).trim();
                if (!title) continue;

                const root = (el.matches("a[data-jk]")
                  ? el.closest("li") || el.parentElement
                  : el) as HTMLElement | null;
                const scope = (root || el) as HTMLElement;

                const companyEl = scope.querySelector(
                  "[data-testid='company-name'], [data-testid='companyName'], span.companyName",
                );
                const locEl = scope.querySelector(
                  "[data-testid='text-location'], div.companyLocation, [data-testid='inlineHeader-companyLocation']",
                );
                const company = ((companyEl && companyEl.textContent) || "").trim();
                const loc = ((locEl && locEl.textContent) || "").trim();

                // 薪资：JP/国际站都落在 attribute_snippet_testid 里，可能有多段
                let salary = "";
                const salaryEls = scope.querySelectorAll("[data-testid='attribute_snippet_testid']");
                for (const s of Array.from(salaryEls)) {
                  const t = ((s as HTMLElement).textContent || "").trim();
                  if (t) salary += salary ? " / " + t : t;
                }

                const snipEl = scope.querySelector(
                  "[data-testid='belowJobSnippet'], div.job-snippet, ul[class*='job-snippet']",
                );
                const snippet = ((snipEl && snipEl.textContent) || "").trim();

                seen.add(jk);
                out.push({
                  jk,
                  title,
                  company,
                  loc,
                  salary,
                  snippet,
                  href: link.getAttribute("href") || "",
                });
                if (out.length >= 60) break;
              }
              return out;
            })
            .catch((e) => {
              console.warn(`[indeed:${opts.label}] extract failed on page ${pageNum}: ${(e as Error).message}`);
              return [] as RawCard[];
            });

          // 跨页累积：只加入未见过的 jk，并受总量上限约束
          let newOnPage = 0;
          for (const r of raw) {
            if (collected.has(r.jk)) continue;
            collected.set(r.jk, r);
            newOnPage++;
            if (collected.size >= INDEED_MAX_TOTAL) break;
          }
          pagesFetched++;

          // 整页都是已见过的卡片（翻到末页/重复页）→ 停止翻页
          if (newOnPage === 0) {
            console.warn(`[indeed:${opts.label}] page ${pageNum} returned no new cards, stopping`);
            break;
          }
          if (pageNum < maxPages - 1) await sleep(INDEED_PAGE_DELAY_MS);
        }

        // 剔除模板卡片，并对同批次内完全重复的岗位去重（同标题+公司+地点只留一条）
        const seenRow = new Set<string>();
        const kept = [...collected.values()].filter((r) => {
          if (isTemplateJk(r.jk)) return false;
          const key = `${r.title}|${r.company}|${r.loc}`;
          if (seenRow.has(key)) return false;
          seenRow.add(key);
          return true;
        });
        const dropped = collected.size - kept.length;
        if (dropped > 0) {
          console.warn(`[indeed:${opts.label}] dropped ${dropped} template/duplicate card(s)`);
        }
        console.warn(
          `[indeed:${opts.label}] '${keyword}': fetched ${pagesFetched} page(s), ${kept.length} unique job(s)`,
        );

        return kept.map((r) => ({
          externalId: `${opts.prefix}-${r.jk}`,
          title: r.title,
          company: r.company || undefined,
          location: r.loc || undefined,
          // 结果页给出的是 /rc/clk 或 /pagead/clk 跳转链接（带一次性 token，会过期且不可复现）。
          // 统一改写成 viewjob?jk= 的规范链接，保证收藏/回访长期有效。
          salary: r.salary || undefined,
          url: `https://${opts.host}/viewjob?jk=${r.jk}`,
          snippet: r.snippet || undefined,
          raw: { jk: r.jk, href: r.href },
        }));
      },
      { locale: opts.locale },
    );
  } catch (e) {
    console.warn(`[indeed:${opts.label}] scrape failed: ${(e as Error).message}`);
    return [];
  }
}

/**
 * 多关键词展开抓取：逐关键词翻页，按 externalId 去重合并。
 * 供 JobSource.searchMany 使用。
 */
async function scrapeIndeedMany(
  opts: IndeedScrapeOpts,
  keywords: string[],
): Promise<SourceJob[]> {
  const merged = new Map<string, SourceJob>();
  for (const kw of keywords) {
    const jobs = await scrapeIndeed(opts, kw, { maxPages: INDEED_MAX_PAGES });
    for (const j of jobs) merged.set(j.externalId, j);
    await sleep(INDEED_PAGE_DELAY_MS);
  }
  return [...merged.values()];
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
  async searchMany(keywords: string[]): Promise<SourceJob[]> {
    return scrapeIndeedMany(
      { host: "jp.indeed.com", locale: "ja-JP", label: "jp", prefix: "indeed" },
      keywords,
    );
  },
};
