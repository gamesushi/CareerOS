// 链接导入岗位：抓取页面正文 → AI 抽取结构化字段 → 返回草稿供前端预览确认。
// 本接口不写库；用户确认后由 /discovered-jobs/submit（via=import）入库。

import { z } from "zod";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";
import { chat } from "@/lib/ai";
import { findDuplicateByUrl } from "@/lib/user-jobs";
import { aiQueue, awaitJobResult } from "@/lib/queue";

const importInput = z.object({
  url: z.string().trim().url("请填写合法的岗位链接").max(2000),
});

export const POST = handler(async (req) => {
  await requireUser();
  const { url } = await parseBody(req, importInput);
  if (!/^https?:\/\//i.test(url)) {
    throw new ApiError(400, "invalid_url", "岗位链接必须以 http(s):// 开头");
  }

  // 先查重：已在库中就不必浪费一次抓取 + AI 调用
  const duplicate = await findDuplicateByUrl(url);

  // Workday 等纯 fetch 拿不到的 JS 重渲染岗位页：交给 worker 无头浏览器抓取。
  // 该分支同步等待 worker 返回抽取结果，复用同一套 draft 结构。
  const ats = detectAts(url);
  if (ats === "workday") {
    const job = await aiQueue.add(
      "fetch_workday_job",
      { url },
      {
        jobId: `wd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
    let draft: JobDraft;
    try {
      draft = (await awaitJobResult(job.id!)) as JobDraft;
    } catch {
      throw new ApiError(
        400,
        "fetch_empty",
        "Workday 职位页由前端 JS 渲染且有反爬，自动抓取仍失败。请打开该职位页后按 Ctrl/Cmd+A 全选复制正文，或使用「手动录入」粘贴 JD 文本。",
      );
    }
    return ok({
      draft: { ...draft, url },
      duplicate: duplicate
        ? { id: duplicate.id, title: duplicate.title, company: duplicate.company, source: duplicate.source }
        : null,
    });
  }

  const text = await fetchUrlText(url);
  const draft = await extractJobFields(text, url);

  return ok({
    draft: { ...draft, url },
    duplicate: duplicate
      ? { id: duplicate.id, title: duplicate.title, company: duplicate.company, source: duplicate.source }
      : null,
  });
});

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const GOOGLEBOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

/** 识别链接所属 ATS / 招聘平台，便于给出针对性的抓取出错提示。 */
function detectAts(url: string): string | null {
  const u = url.toLowerCase();
  if (u.includes("myworkdayjobs.com") || u.includes("workday.com")) return "workday";
  if (u.includes("greenhouse.io")) return "greenhouse";
  if (u.includes("lever.co")) return "lever";
  if (u.includes("ashbyhq.com")) return "ashby";
  if (u.includes("smartrecruiters.com")) return "smartrecruiters";
  if (u.includes("taleo")) return "taleo";
  return null;
}

/** HTML → 纯文本（去脚本/样式/标签）。 */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 从页面内联的 JSON-LD 中抽取 JobPosting 的结构化正文（部分站点把职位描述塞在这里）。 */
function extractJobPostingLd(html: string): string {
  const blocks = [
    ...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  for (const m of blocks) {
    try {
      const json = JSON.parse(m[1].trim());
      const nodes = Array.isArray(json) ? json : [json];
      for (const node of nodes) {
        const post =
          node?.["@type"] === "JobPosting"
            ? node
            : node?.graph?.find?.((g: { "@type"?: string }) => g?.["@type"] === "JobPosting");
        const desc = post?.description ?? post?.jobLocation?.description;
        if (typeof desc === "string" && desc.length > 80) return htmlToText(desc);
      }
    } catch {
      /* 单个 JSON-LD 解析失败不影响其它来源 */
    }
  }
  return "";
}

async function fetchUrlText(url: string): Promise<string> {
  const ats = detectAts(url);
  const fetchHtml = async (ua: string) => {
    const res = await fetch(url, {
      headers: { "User-Agent": ua, "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7" },
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
    return res && res.ok ? await res.text().catch(() => "") : "";
  };

  let html = await fetchHtml(CHROME_UA);
  // 反爬墙常放行 Googlebot，二次尝试
  if (html.length < 400) html = await fetchHtml(GOOGLEBOT_UA);

  const text = htmlToText(html);
  const ld = extractJobPostingLd(html);
  const combined = [text, ld].filter(Boolean).join("\n\n").trim();

  if (combined.length < 80) {
    const msg =
      ats === "workday"
        ? "Workday 职位页由前端 JS 渲染且有反爬，自动抓取通常失败。请打开该职位页后按 Ctrl/Cmd+A 全选复制正文，或使用「手动录入」粘贴 JD 文本。"
        : "链接正文过短（页面可能是纯前端渲染或被反爬拦截），请改用「手动录入」粘贴岗位信息";
    throw new ApiError(400, "fetch_empty", msg);
  }
  return combined.slice(0, 60_000);
}

type JobDraft = {
  title: string;
  company: string | null;
  location: string | null;
  salary: string | null;
  snippet: string | null;
  publishedAt: string | null;
};

async function extractJobFields(text: string, url: string): Promise<JobDraft> {
  const system = [
    "你是招聘信息结构化助手。从给定的网页正文中抽取一条岗位信息，输出 JSON 对象，字段：",
    'title（职位名称，必填，找不到时给 ""）、company（公司名或 null）、location（工作地点或 null）、',
    "salary（薪资范围原文或 null）、snippet（岗位职责/要求摘要，200 字以内，或 null）、",
    "publishedAt（发布日期 ISO 8601 如 2026-07-01T00:00:00+08:00，找不到就 null）。",
    "只输出 JSON，不要编造正文中不存在的信息。",
  ].join("");
  const result = await chat({
    system,
    user: `页面 URL：${url}\n\n页面正文：\n${text}`,
    json: true,
    temperature: 0,
  });

  let parsed: Partial<JobDraft> & { mock?: boolean };
  try {
    parsed = JSON.parse(result.content);
  } catch {
    throw new ApiError(502, "ai_parse_failed", "AI 返回的结构无法解析，请稍后重试或改用手动录入");
  }
  if (parsed.mock) {
    throw new ApiError(503, "ai_unavailable", "AI 服务未配置，请改用手动录入");
  }
  const clean = (v: unknown, max: number): string | null =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

  const title = clean(parsed.title, 200);
  if (!title) {
    throw new ApiError(422, "no_job_found", "该页面中未识别到岗位信息，请确认链接是具体的职位详情页");
  }
  // publishedAt 合法性校验（Invalid Date 不下发）
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
