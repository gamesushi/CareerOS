import { z } from "zod";
import { handler, ok, parseBody, requireAdmin } from "@/lib/api";
import { getAlertConfig, setAlertConfig } from "@/lib/admin/alerts";
import { logAdminAction } from "@/lib/admin/audit";

const cfgInput = z.object({
  enabled: z.boolean(),
  dailyThresholdUsd: z.number().min(0).max(1_000_000),
  webhookUrl: z.string().max(500).optional(),
});

export const GET = handler(async () => {
  await requireAdmin();
  return ok(await getAlertConfig());
});

export const PUT = handler(async (req) => {
  const { userId } = await requireAdmin();
  const input = await parseBody(req, cfgInput);
  const webhookUrl = input.webhookUrl?.trim() ? input.webhookUrl.trim() : null;
  await setAlertConfig({ enabled: input.enabled, dailyThresholdUsd: input.dailyThresholdUsd, webhookUrl }, userId);
  await logAdminAction({
    actorId: userId,
    action: "other",
    targetType: "alert_config",
    after: { enabled: input.enabled, threshold: input.dailyThresholdUsd, webhook: webhookUrl ? "set" : null },
    reason: "更新成本告警配置",
  });
  return ok({ ok: true });
});
