// 雇主发布岗下架/恢复（诈骗、幽灵岗）。与 /api/admin/jobs/takedown 同义，
// 区别是发布岗是全局单条记录，按 id 定位即可，不需要 (source, externalId) 跨用户批量。

import { z } from "zod";
import { handler, ok, parseBody, requireAdmin, ApiError } from "@/lib/api";
import { takedownPosting } from "@/lib/admin/jobs";
import { logAdminAction } from "@/lib/admin/audit";

const input = z.object({
  id: z.string().uuid(),
  restore: z.boolean().default(false),
  reason: z.string().max(500).optional(),
});

export const POST = handler(async (req) => {
  const { userId: actorId } = await requireAdmin();
  const { id, restore, reason } = await parseBody(req, input);

  const before = await takedownPosting(id, restore, actorId);
  if (!before) throw new ApiError(404, "not_found", "发布不存在");

  await logAdminAction({
    actorId,
    action: "job_takedown",
    targetType: "job_posting",
    targetId: id,
    before: { takenDownAt: before.takenDownAt },
    after: { restore },
    reason: reason ?? null,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  return ok({ ok: true, id, restore });
});
