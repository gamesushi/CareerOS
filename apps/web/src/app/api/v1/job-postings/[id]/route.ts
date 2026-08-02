// 发布者自管：PATCH 改状态（下架/重开/存回草稿）、DELETE 删草稿。
// 一律带 postedByUserId 条件做归属校验，防止改到别人的岗。

import { prisma } from "@careeros/db";
import { jobPostingStatusInput, EMPLOYER_ROLES } from "@careeros/shared";
import { handler, ok, parseBody, requireRole, ApiError } from "@/lib/api";

export const PATCH = handler(async (req, { params }) => {
  const { userId } = await requireRole(EMPLOYER_ROLES);
  const { id } = await params;
  const input = await parseBody(req, jobPostingStatusInput);

  const own = await prisma.jobPosting.findFirst({
    where: { id, postedByUserId: userId },
    select: { id: true, reviewStatus: true },
  });
  if (!own) throw new ApiError(404, "not_found", "岗位不存在");

  const updated = await prisma.jobPosting.update({
    where: { id },
    data: {
      status: input.status,
      closedAt: input.status === "closed" ? new Date() : null,
      // 草稿转发布时若此前被拒，重新进入待审队列（改过内容应重新审）
      ...(input.status === "open" && own.reviewStatus === "rejected"
        ? { reviewStatus: "pending" as const, reviewNote: null }
        : {}),
    },
    select: { id: true, status: true, reviewStatus: true },
  });
  return ok(updated);
});

export const DELETE = handler(async (_req, { params }) => {
  const { userId } = await requireRole(EMPLOYER_ROLES);
  const { id } = await params;

  // 只允许删草稿：已发布过的岗留痕（候选人可能已看到/投递过外链），改用「下架」
  const own = await prisma.jobPosting.findFirst({
    where: { id, postedByUserId: userId },
    select: { status: true },
  });
  if (!own) throw new ApiError(404, "not_found", "岗位不存在");
  if (own.status !== "draft") {
    throw new ApiError(400, "not_draft", "已发布的岗位只能下架，不能删除");
  }
  await prisma.jobPosting.delete({ where: { id } });
  return ok({ ok: true, id });
});
