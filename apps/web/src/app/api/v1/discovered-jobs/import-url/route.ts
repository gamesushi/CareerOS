// 链接导入岗位：抓取页面正文 → AI 抽取结构化字段 → 返回草稿供前端预览确认。
// 本接口不写库；用户确认后由 /discovered-jobs/submit（via=import）入库。

import { z } from "zod";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";
import { chat } from "@/lib/ai";
import { findDuplicateByUrl } from "@/lib/user-jobs";

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

  const text = await fetchUrlText(url);
  const draft = await extractJobFields(text, url);

  return ok({
    draft: { ...draft, url },
    duplicate: duplicate
      ? { id: duplicate.id, title: duplicate.title, company: duplicate.company, source: duplicate.source }
      : null,
  });
});

async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7",
    },
    signal: AbortSignal.timeout(20_000),
  }).catch((e) => {
    throw new ApiError(400, "fetch_failed", `抓取链接失败：${(e as Error).message}`);
  });
  if (!res.ok) throw new ApiError(400, "fetch_failed", `抓取链接失败：HTTP ${res.status}`);
  const html = await res.text();
  const text = html
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
  if (text.length < 80) {
    throw new ApiError(
      400,
      "fetch_empty",
      "链接正文过短（页面可能是纯前端渲染或被反爬拦截），请改用「手动录入」粘贴岗位信息",
    );
  }
  return text.slice(0, 60_000);
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
