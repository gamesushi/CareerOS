// 简历 PDF 渲染：合并共享个人档案 → 选模板/强调色 → react-pdf 出 buffer。
//
// 抽出来是因为有两个调用方：简历owner自己导出（resumes/[id]/export）与雇主查看
// 候选人投来的那一份（job-applications/[id]/resume）。两边的差别只在**授权**，
// 渲染逻辑必须是同一份，否则雇主看到的简历会跟候选人导出的不一致。

import { createElement } from "react";
import { prisma, type Resume } from "@careeros/db";
import { jsonResume, type JsonResume } from "@careeros/shared";
import { resolveTemplate } from "@/lib/pdf/registry";
import { mergePersonalIntoResume } from "@/lib/merge-personal";

export class ResumeRenderError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** 合并简历 JSON 与其所有者的共享个人档案（User + CareerProfile.personal）。 */
export async function mergedResumeOf(resume: Resume) {
  const owner = await prisma.user.findUnique({
    where: { id: resume.userId },
    include: { careerProfile: true },
  });
  const parsed = jsonResume.safeParse(resume.resumeJson);
  if (!parsed.success) throw new ResumeRenderError(409, "简历内容尚未生成或格式无效");
  return mergePersonalIntoResume(
    { ...parsed.data, templateId: resume.templateId, resumeType: resume.resumeType },
    owner ?? {},
    owner?.careerProfile ?? null,
  );
}

/**
 * 按 resume["x-sections"] 过滤隐藏的区块。
 * 隐藏段（值为 false）在渲染前清空其数组，使所有模板统一跳过（模板均按 length>0 守卫）。
 * 不影响数据源：DB 中的 resumeJson 保留完整内容，仅渲染输出剔除。
 */
const SECTION_KEYS = ["work", "projects", "skills", "education", "awards"] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

function applySectionVisibility(resume: JsonResume): JsonResume {
  const vis = (resume["x-sections"] ?? {}) as Partial<Record<SectionKey, boolean>>;
  let changed = false;
  const out: JsonResume = { ...resume };
  for (const key of SECTION_KEYS) {
    if (vis[key] === false && Array.isArray((resume as Record<string, unknown>)[key])) {
      (out as Record<string, unknown>)[key] = [];
      changed = true;
    }
  }
  return changed ? out : resume;
}

/** 供导出路由（md/doc/docx 等非 PDF 分支）复用同一套段可见性过滤逻辑。 */
export { applySectionVisibility };

/** 渲染 PDF。templateId/accent 可覆盖（预览用），不传则取简历自身设置。 */
export async function renderResumePdf(
  resume: Resume,
  opts: { templateId?: string | null; accent?: string | null } = {},
): Promise<Buffer> {
  const merged = await mergedResumeOf(resume);
  // CV（长版学术/欧洲简历）不限制页数；普通 resume 由用户自行精简，
  // 超出两页仅在使用侧预警，不在此强制缩放/截断。
  const visible = applySectionVisibility(merged);
  const template = resolveTemplate(opts.templateId ?? resume.templateId);
  const accent =
    (opts.accent && /^#[0-9a-fA-F]{6}$/.test(opts.accent) ? opts.accent : null) ??
    merged["x-theme"]?.accent ??
    template.defaultAccent;

  const { renderToBuffer } = await import("@react-pdf/renderer");
  type DocElement = Parameters<typeof renderToBuffer>[0];
  try {
    return await renderToBuffer(
      createElement(template.component, {
        resume: visible,
        lang: resume.resumeType,
        accent,
      }) as unknown as DocElement,
    );
  } catch (e) {
    console.error("[pdf] render failed:", e);
    throw new ResumeRenderError(500, e instanceof Error ? e.message : "PDF 渲染失败");
  }
}

/** 统一的 PDF 响应头。inline=true 时浏览器内嵌显示而非下载。 */
export function pdfResponse(buffer: Buffer, fileName: string, inline: boolean) {
  const safe = encodeURIComponent(fileName.replace(/[\\/:*?"<>|]/g, "_"));
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${safe}.pdf`,
      "Cache-Control": "no-store",
    },
  });
}
