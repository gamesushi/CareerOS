// 某岗位的投递：POST 候选人投递 / GET 雇主收件箱。
// 同一路径两个方向，门禁完全不同——POST 只要登录，GET 必须是该岗位的雇主。

import { prisma } from "@careeros/db";
import { jobApplicationCreateInput } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";
import {
  applicationCreateData,
  assertApplicable,
  listApplicationsForPosting,
  requireEmployerOnPosting,
} from "@/lib/job-applications";

export const GET = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const posting = await requireEmployerOnPosting(id, userId);
  return ok({ posting, data: await listApplicationsForPosting(id) });
});

export const POST = handler(async (req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const input = await parseBody(req, jobApplicationCreateInput);

  await assertApplicable(id, userId);

  // 简历必须是自己的——否则拿到别人的 resumeId 就能把别人的简历投出去
  if (input.resumeId) {
    const own = await prisma.resume.findFirst({
      where: { id: input.resumeId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!own) throw new ApiError(404, "resume_not_found", "简历不存在");
  }

  try {
    const created = await prisma.jobApplication.create({
      data: applicationCreateData(id, userId, input.resumeId ?? null, input.coverLetter ?? null),
      select: { id: true, status: true, createdAt: true },
    });
    return ok(created, 201);
  } catch (e) {
    // 唯一键 (jobPostingId, candidateId) 冲突 → 已经投过
    if ((e as { code?: string }).code === "P2002") {
      throw new ApiError(409, "already_applied", "你已经投递过这个岗位了");
    }
    throw e;
  }
});
