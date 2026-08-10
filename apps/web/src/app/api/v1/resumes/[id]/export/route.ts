import { prisma } from "@careeros/db";
import { jsonResume, type JsonResume } from "@careeros/shared";
import { requireUser, ApiError } from "@/lib/api";
import { mergePersonalIntoResume } from "@/lib/merge-personal";
import { renderResumePdf, pdfResponse, ResumeRenderError, applySectionVisibility } from "@/lib/pdf/render";

// PDF 导出：react-pdf 服务端渲染，直接流式返回。
// ?inline=1 时浏览器内嵌显示（编辑器预览 iframe 复用同一渲染器，所见即所得）。
// ?template= / ?accent= 允许预览时临时覆盖（不落库，落库走 PUT）。

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    ({ userId } = await requireUser());
  } catch (e) {
    if (e instanceof ApiError) {
      return new Response(e.message, { status: e.status });
    }
    throw e;
  }
  const { id } = await params;

  const resume = await prisma.resume.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!resume) return new Response("not found", { status: 404 });

  // 合并共享个人档案（User + CareerProfile.personal），使所有简历同步生效。
  const owner = await prisma.user.findUnique({
    where: { id: userId },
    include: { careerProfile: true },
  });
  const rawJson = jsonResume.safeParse(resume.resumeJson);
  if (!rawJson.success) return new Response("简历内容尚未生成或格式无效", { status: 409 });
  const merged = mergePersonalIntoResume(
    { ...rawJson.data, templateId: resume.templateId, resumeType: resume.resumeType },
    owner ?? {},
    owner?.careerProfile ?? null,
  );
  const url = new URL(req.url);
  const accentParam = url.searchParams.get("accent");
  // 注：模板与强调色的回退链在 renderResumePdf 内统一处理，这里不再重复计算。

  // 导出格式：pdf（默认）/ docx / doc / md
  const FORMATS = ["pdf", "docx", "doc", "md"] as const;
  const rawFmt = (url.searchParams.get("format") ?? "pdf").toLowerCase();
  const format: (typeof FORMATS)[number] =
    (FORMATS as readonly string[]).includes(rawFmt) ? (rawFmt as (typeof FORMATS)[number]) : "pdf";
  const baseName = encodeURIComponent(`${resume.title.replace(/[\\/:*?"<>|]/g, "_")}`);

  // 段可见性开关对所有格式（pdf/md/doc/docx）统一生效
  const visibleMerged = applySectionVisibility(merged as JsonResume);

  if (format !== "pdf") {
    try {
      if (format === "md") {
        const { resumeToMarkdown } = await import("@/lib/export/markdown");
        const md = resumeToMarkdown(visibleMerged as JsonResume);
        return new Response(md, {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename*=UTF-8''${baseName}.md`,
            "Cache-Control": "no-store",
          },
        });
      }
      if (format === "doc") {
        const { resumeToDoc } = await import("@/lib/export/doc");
        const html = resumeToDoc(visibleMerged as JsonResume);
        return new Response(html, {
          headers: {
            "Content-Type": "application/msword; charset=utf-8",
            "Content-Disposition": `attachment; filename*=UTF-8''${baseName}.doc`,
            "Cache-Control": "no-store",
          },
        });
      }
      const { resumeToDocx } = await import("@/lib/export/docx");
      const buf = await resumeToDocx(visibleMerged as JsonResume);
      return new Response(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename*=UTF-8''${baseName}.docx`,
          "Cache-Control": "no-store",
        },
      });
    } catch (e) {
      console.error("[export] non-pdf render failed:", e);
      const message = e instanceof Error ? e.message : "文档生成失败";
      return new Response(JSON.stringify({ error: { code: "RENDER_FAILED", message } }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
  }

  // PDF 渲染与雇主查看投递简历共用同一份实现（lib/pdf/render.ts），避免两边漂移。
  let buffer: Buffer;
  try {
    buffer = await renderResumePdf(resume, {
      templateId: url.searchParams.get("template") ?? resume.templateId,
      accent: accentParam,
    });
  } catch (e) {
    const message = e instanceof ResumeRenderError ? e.message : "PDF 渲染失败";
    return new Response(JSON.stringify({ error: { code: "RENDER_FAILED", message } }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
  return pdfResponse(buffer, resume.title, url.searchParams.get("inline") === "1");
}
