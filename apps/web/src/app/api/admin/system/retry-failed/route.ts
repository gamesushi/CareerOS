import { z } from "zod";
import { handler, ok, parseBody, requireAdmin, ApiError } from "@/lib/api";
import { retryFailed, QUEUES } from "@/lib/admin/system";
import { logAdminAction } from "@/lib/admin/audit";

const input = z.object({ queue: z.string().min(1).max(32) });

export const POST = handler(async (req) => {
  const { userId: actorId } = await requireAdmin();
  const { queue } = await parseBody(req, input);
  if (!QUEUES[queue]) throw new ApiError(400, "bad_queue", "未知队列");

  const retried = await retryFailed(queue);
  await logAdminAction({
    actorId,
    action: "other",
    targetType: "queue",
    targetId: null,
    after: { queue, retried },
    reason: `重试失败任务：${queue}`,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  return ok({ ok: true, retried });
});
