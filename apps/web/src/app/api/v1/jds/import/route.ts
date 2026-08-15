import { randomUUID } from "node:crypto";
import { prisma } from "@careeros/db";
import { jdImportInput } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";
import { putObject } from "@/lib/s3";
import { aiQueue } from "@/lib/queue";

// JD 三态导入：JSON {text|url} 或 multipart 文件

const ALLOWED_EXT = ["pdf", "docx", "doc", "md", "txt"];

export const POST = handler(async (req) => {
  const { userId } = await requireUser();
  const contentType = req.headers.get("content-type") ?? "";

  let data: { rawContent: string; fileKey?: string; sourceUrl?: string; company?: string; title?: string };

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "missing_file", "缺少 file 字段");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXT.includes(ext)) throw new ApiError(400, "unsupported_type", `不支持的文件类型 .${ext}`);
    if (file.size > 10 * 1024 * 1024) throw new ApiError(400, "too_large", "文件不能超过 10MB");
    const fileKey = `jds/${userId}/${randomUUID()}.${ext}`;
    await putObject(fileKey, Buffer.from(await file.arrayBuffer()), file.type || "application/octet-stream");
    data = { rawContent: "", fileKey };
  } else {
    const input = await parseBody(req, jdImportInput);
    if (input.url) {
      const text = await fetchUrlText(input.url);
      data = { rawContent: text, sourceUrl: input.url, company: input.company, title: input.title };
    } else {
      data = { rawContent: input.text!, company: input.company, title: input.title };
    }
  }

  const jd = await prisma.jobDescription.create({
    data: {
      userId,
      rawContent: data.rawContent,
      fileKey: data.fileKey,
      sourceUrl: data.sourceUrl,
      company: data.company,
      title: data.title,
      status: "pending",
    },
  });
  await aiQueue.add("jd_parse", { jdId: jd.id }, { jobId: `jd-parse-${jd.id}` });
  return ok({ jdId: jd.id, status: jd.status }, 202);
});

async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; uCareerOS/0.1)" },
    signal: AbortSignal.timeout(15_000),
  }).catch((e) => {
    throw new ApiError(400, "fetch_failed", `抓取链接失败：${e.message}`);
  });
  if (!res.ok) throw new ApiError(400, "fetch_failed", `抓取链接失败：HTTP ${res.status}`);
  const html = await res.text();
  // 粗提正文：去 script/style/tag，保留换行结构。招聘站反爬严重时建议直接粘贴文本。
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length < 100) {
    throw new ApiError(400, "fetch_empty", "链接正文过短（可能被反爬拦截），请直接粘贴 JD 文本");
  }
  return text.slice(0, 100_000);
}
