// 管理员审核用户录入岗位：通过（进公共统计/排行榜）或拒绝（仅提交者可见被拒状态）。
import { z } from "zod";
import { handler, ok, parseBody, requireAdmin, ApiError } from "@/lib/api";
import { reviewUserJob } from "@/lib/admin/jobs";
import { logAdminAction } from "@/lib/admin/audit";

const input = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(500).optional(),
});

export const POST = handler(async (req) => {
  const { userId: actorId } = await requireAdmin();
  const { id, decision, note } = await parseBody(req, input);

  const before = await reviewUserJob(id, decision, actorId, note);
  if (!before) {
    throw new ApiError(404, "not_found", "岗位不存在或不属于用户录入来源（user/import）");
  }

  await logAdminAction({
    actorId,
    action: "job_review",
    targetType: "discovered_job",
    targetId: id,
    before: { reviewStatus: before.reviewStatus },
    after: { reviewStatus: decision, note: note ?? null },
    reason: note ?? null,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  return ok({ ok: true, id, decision });
});
