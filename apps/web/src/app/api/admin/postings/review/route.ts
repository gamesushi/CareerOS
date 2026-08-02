// 管理员审核雇主发布岗：通过（进候选端公共流）或拒绝（仅发布者可见拒绝理由）。
// 复用 AdminAction.job_review，用 targetType 区分是 discovered_job 还是 job_posting。

import { z } from "zod";
import { handler, ok, parseBody, requireAdmin, ApiError } from "@/lib/api";
import { reviewJobPosting } from "@/lib/admin/jobs";
import { logAdminAction } from "@/lib/admin/audit";

const input = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(500).optional(),
});

export const POST = handler(async (req) => {
  const { userId: actorId } = await requireAdmin();
  const { id, decision, note } = await parseBody(req, input);

  const before = await reviewJobPosting(id, decision, actorId, note);
  if (!before) throw new ApiError(404, "not_found", "发布不存在或仍是草稿");

  await logAdminAction({
    actorId,
    action: "job_review",
    targetType: "job_posting",
    targetId: id,
    before: { reviewStatus: before.reviewStatus },
    after: { reviewStatus: decision, note: note ?? null },
    reason: note ?? null,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  return ok({ ok: true, id, decision });
});
