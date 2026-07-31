import { handler, ok, requireAdmin } from "@/lib/api";
import { getOverviewMetrics } from "@/lib/admin/metrics";

export const GET = handler(async () => {
  await requireAdmin();
  return ok(await getOverviewMetrics());
});
