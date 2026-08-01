import { z } from "zod";
import { prisma, type ResumeType } from "@careeros/db";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";
import { aiQueue } from "@/lib/queue";
import { TYPE_DEFAULT_TEMPLATE } from "@/lib/pdf/template-meta";

const deriveInput = z.object({
  targetType: z.enum(["zh", "en", "ja_shokumu", "ja_rirekisho"] as const),
  title: z.string().min(1).max(160).optional(),
  templateId: z.string().optional(),
});

export const POST = handler(async (req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const { targetType, title, templateId } = await parseBody(req, deriveInput);

  const sourceResume = await prisma.resume.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!sourceResume) throw new ApiError(404, "not_found", "源简历不存在");

  const defaultTitle = `${sourceResume.title} (${targetType})`;
  const finalTitle = title || defaultTitle;
  const finalTemplateId =
    templateId || TYPE_DEFAULT_TEMPLATE[targetType] || sourceResume.templateId || "classic";

  const newResume = await prisma.resume.create({
    data: {
      userId,
      title: finalTitle,
      resumeType: targetType as ResumeType,
      templateId: finalTemplateId,
      sourceResumeId: sourceResume.id,
      jdId: sourceResume.jdId,
      resumeJson: {},
      status: "draft",
    },
  });

  await aiQueue.add(
    "resume_derive",
    {
      resumeId: newResume.id,
      sourceResumeId: sourceResume.id,
      targetType,
    },
    { jobId: `resume-derive-${newResume.id}` },
  );

  return ok({ resumeId: newResume.id }, 202);
});
