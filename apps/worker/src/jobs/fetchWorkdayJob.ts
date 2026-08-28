// Workday 无头连接器：纯 fetch 拿不到的 JS 重渲染岗位页，
// 在 worker 侧用 Playwright 无头浏览器渲染后抽取正文，再交给 AI 结构化。
//
// 失败语义：
// - workday_render_empty：页面渲染后仍无实质正文（命中反爬/拦截/登录墙）→ 由 web 路由转成「手动录入」提示。
// - ai_parse_failed / no_job_found：AI 未从正文识别出岗位 → 同上。
// 这些错误会被 BullMQ 任务抛出，web 侧 awaitJobResult 捕获后给出友好提示，不污染数据库。

import { chat } from "../ai/provider";
import { withBrowser, waitForAny } from "../sources/lib/headless";

export type WorkdayDraft = {
  title: string;
  company: string | null;
  location: string | null;
  salary: string | null;
  snippet: string | null;
  publishedAt: string | null;
};

// Workday 现代站点（React）与旧版站点的职位描述容器选择器，取第一个真实出现者。
const WORKDAY_SELECTORS = [
  '[data-automation-id="jobPostingDescription"]',
  "#jobPostingDescription",
  '[data-automation-id="jobPostingHeader"]',
  'main',
  "#mainContent",
];

/** 用无头浏览器渲染 Workday 职位页，抽回正文文本（优先职位描述容器）。 */
async function renderWorkday(url: string): Promise<string> {
  return withBrowser(
    async ({ page }) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      // Workday 多数岗位由 React 懒加载，先等描述容器出现
      await waitForAny(page, WORKDAY_SELECTORS, 20_000).catch(() => {});
      await page.waitForTimeout(2500).catch(() => {});

      const sel = await waitForAny(page, WORKDAY_SELECTORS, 6_000).catch(() => null);
      let text = "";
      if (sel) {
        const handle = await page.$(sel).catch(() => null);
        if (handle) {
          text = (await handle.innerText().catch(() => "")) ?? "";
          await handle.dispose().catch(() => {});
        }
      }
      if (!text || text.trim().length < 120) {
        text = (await page.locator("body").innerText().catch(() => "")) ?? "";
      }
      return text;
    },
    { locale: "en-US" },
  );
}

/** 从正文抽取单条岗位草稿（与 web 侧 JobDraft 字段对齐）。 */
async function extractDraft(text: string, url: string): Promise<WorkdayDraft> {
  const system = [
    "You are a job-posting parser. Extract ONE job posting from the page text and output JSON with fields:",
    'title (string, required; "" if not found), company (string|null), location (string|null),',
    "salary (string|null, original text), snippet (string|null, <=200 chars summary of duties/requirements),",
    "publishedAt (ISO 8601 like 2026-07-01T00:00:00+08:00, or null).",
    "Output JSON only. Do not invent information not present in the text.",
  ].join(" ");
  const result = await chat({
    system,
    user: `URL: ${url}\n\nTEXT:\n${text}`,
    json: true,
    temperature: 0,
  });
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(result.content);
  } catch {
    throw new Error("ai_parse_failed");
  }
  const clean = (v: unknown, max: number): string | null =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

  const title = clean(parsed.title, 200);
  if (!title) throw new Error("no_job_found");

  let publishedAt: string | null = null;
  if (typeof parsed.publishedAt === "string" && parsed.publishedAt) {
    const d = new Date(parsed.publishedAt);
    if (!Number.isNaN(d.getTime())) publishedAt = d.toISOString();
  }
  return {
    title,
    company: clean(parsed.company, 128),
    location: clean(parsed.location, 128),
    salary: clean(parsed.salary, 64),
    snippet: clean(parsed.snippet, 2000),
    publishedAt,
  };
}

export async function handleFetchWorkdayJob(url: string): Promise<WorkdayDraft> {
  const text = await renderWorkday(url);
  if (!text || text.trim().length < 120) {
    throw new Error("workday_render_empty");
  }
  return extractDraft(text, url);
}
