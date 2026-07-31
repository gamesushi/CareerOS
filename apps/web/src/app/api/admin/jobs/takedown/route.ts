import { z } from "zod";
import { handler, ok, parseBody, requireAdmin } from "@/lib/api";
import { takedownByExternal } from "@/lib/admin/jobs";
import { logAdminAction } from "@/lib/admin/audit";

const input = z.object({
  source: z.string().min(1).max(32),
  externalId: z.string().min(1).max(128),
  restore: z.boolean().default(false),
  reason: z.string().max(500).optional(),
});

export const POST = handler(async (req) => {
  const { userId: actorId } = await requireAdmin();
  const { source, externalId, restore, reason } = await parseBody(req, input);
  const affected = await takedownByExternal(source, externalId, restore, actorId);

  await logAdminAction({
    actorId,
    action: "job_takedown",
    targetType: "discovered_job",
    targetId: null,
    before: null,
    after: { source, externalId, restore, affected },
    reason: reason ?? null,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  return ok({ ok: true, affected });
});
