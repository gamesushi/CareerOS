import { prisma } from "@careeros/db";
import { resumeGenerateInput } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";
import { aiQueue } from "@/lib/queue";
import { TYPE_DEFAULT_TEMPLATE } from "@/lib/pdf/template-meta";

const TYPE_LABEL: Record<string, string> = {
  zh: "中文简历",
  en: "English Resume",
  ja_shokumu: "職務経歴書",
  ja_rirekisho: "履歴書",
};

export const POST = handler(async (req) => {
  const { userId } = await requireUser();
  const input = await parseBody(req, resumeGenerateInput);

  let title = `通用 · ${TYPE_LABEL[input.resumeType]}`;
  if (input.jdId) {
    const jd = await prisma.jobDescription.findFirst({ where: { id: input.jdId, userId } });
    if (!jd) throw new ApiError(404, "not_found", "JD 不存在");
    title = `${[jd.company, jd.title].filter(Boolean).join(" ") || "定向"} · ${TYPE_LABEL[input.resumeType]}`;
  }

  const version = await prisma.resume.count({ where: { userId, title } });
  const resume = await prisma.resume.create({
    data: {
      userId,
      title,
      resumeType: input.resumeType,
      version: version + 1,
      // 日文文书类型未显式选模板时强制专用模板
      templateId:
        input.templateId === "classic" && TYPE_DEFAULT_TEMPLATE[input.resumeType]
          ? TYPE_DEFAULT_TEMPLATE[input.resumeType]
          : input.templateId,
      resumeJson: {}, // 生成完成前为空，编辑器轮询
      jdId: input.jdId ?? null,
      status: "draft",
    },
  });
  await aiQueue.add("resume_generate", { resumeId: resume.id }, { jobId: `resume-gen-${resume.id}` });
  return ok({ resumeId: resume.id }, 202);
});
