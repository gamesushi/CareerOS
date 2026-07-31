import { prisma, DiscoveredJobStatus } from "@careeros/db";
import { handler, ok, requireUser } from "@/lib/api";

export const GET = handler(async (req) => {
  const { userId } = await requireUser();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const watchId = url.searchParams.get("watch_id");

  const data = await prisma.discoveredJob.findMany({
    where: {
      userId,
      takenDownAt: null, // 管理员下架（诈骗/幽灵岗）的岗位不进用户 feed
      ...(status && status !== "all" ? { status: status as DiscoveredJobStatus } : { status: { not: "dismissed" } }),
      ...(watchId ? { watchId } : {}),
    },
    // 已评分优先按 fit 分降序，未评分（null）排后，再按时间兜底
    orderBy: [{ matchScore: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 200,
    include: { watch: { select: { name: true } } },
  });
  return ok({ data });
});
