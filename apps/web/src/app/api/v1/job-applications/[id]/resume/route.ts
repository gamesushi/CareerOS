// 雇主查看候选人投来的那一份简历（PDF，inline）。
//
// 授权只认「这条投递」：调用者必须是该岗位的发布者或其组织成员，且简历必须正是
// 这条投递里的那一份。刻意不按 resumeId 直查——否则 resumeId 就成了访问令牌。
// 候选人撤回后授权同时收回（withdrawn 一律 403）。

import { prisma } from "@careeros/db";
import { requireUser, ApiError } from "@/lib/api";
import { requireEmployerOnApplication } from "@/lib/job-applications";
import { renderResumePdf, pdfResponse, ResumeRenderError } from "@/lib/pdf/render";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireUser();
    const { id } = await params;
    const app = await requireEmployerOnApplication(id, userId);

    if (app.status === "withdrawn") {
      throw new ApiError(403, "withdrawn", "候选人已撤回投递，简历不再可见");
    }
    if (!app.resumeId) throw new ApiError(404, "no_resume", "该投递没有附简历");

    const resume = await prisma.resume.findFirst({
      where: { id: app.resumeId, deletedAt: null },
    });
    if (!resume) throw new ApiError(404, "resume_deleted", "候选人已删除该简历");

    const buffer = await renderResumePdf(resume);
    const inline = new URL(req.url).searchParams.get("inline") !== "0";
    return pdfResponse(buffer, resume.title, inline);
  } catch (e) {
    if (e instanceof ApiError) return new Response(e.message, { status: e.status });
    if (e instanceof ResumeRenderError) return new Response(e.message, { status: e.status });
    console.error("[job-applications/resume]", e);
    return new Response("服务器内部错误", { status: 500 });
  }
}
