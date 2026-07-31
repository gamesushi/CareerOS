import { handler, ok, requireAdmin } from "@/lib/api";
import { getUsageMetrics } from "@/lib/admin/metrics";

export const GET = handler(async (req) => {
  await requireAdmin();
  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get("days")) || 30, 1), 90);
  return ok(await getUsageMetrics(days));
});
