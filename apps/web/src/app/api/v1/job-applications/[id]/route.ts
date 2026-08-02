// 投递状态流转：雇主推进/拒绝 + 写备注；候选人撤回。
// 同一个 PATCH 按调用者身份分支——先看是不是候选人本人，否则再验雇主身份。

import { prisma } from "@careeros/db";
import { jobApplicationUpdateInput } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";
import { assertTransition, requireEmployerOnApplication } from "@/lib/job-applications";

export const PATCH = handler(async (req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const input = await parseBody(req, jobApplicationUpdateInput);

  const app = await prisma.jobApplication.findUnique({
    where: { id },
    select: { id: true, status: true, candidateId: true },
  });
  if (!app) throw new ApiError(404, "not_found", "投递不存在");

  const isCandidate = app.candidateId === userId;
  if (!isCandidate) await requireEmployerOnApplication(id, userId); // 非本人则必须是该岗位雇主

  // 候选人不能写雇主备注（那是雇主的私有字段，候选人侧读写都不该有）
  if (isCandidate && input.employerNote !== undefined) {
    throw new ApiError(403, "forbidden", "无权修改该字段");
  }
  if (input.status) {
    assertTransition(app.status, input.status, isCandidate ? "candidate" : "employer");
  }

  const updated = await prisma.jobApplication.update({
    where: { id },
    data: {
      ...(input.status ? { status: input.status, statusAt: new Date() } : {}),
      ...(input.employerNote !== undefined ? { employerNote: input.employerNote || null } : {}),
    },
    select: { id: true, status: true, statusAt: true },
  });
  return ok(updated);
});
