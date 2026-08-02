import { prisma, DiscoveredJobStatus } from "@careeros/db";
import { handler, ok, requireUser } from "@/lib/api";

export const GET = handler(async (req) => {
  const { userId } = await requireUser();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const watchId = url.searchParams.get("watch_id");
  const closed = url.searchParams.get("closed"); // all | active | closed
  const source = url.searchParams.get("source"); // 来源 id 或空

  const data = await prisma.discoveredJob.findMany({
    where: {
      userId,
      takenDownAt: null, // 管理员下架（诈骗/幽灵岗）的岗位不进用户 feed
      ...(status && status !== "all" ? { status: status as DiscoveredJobStatus } : { status: { not: "dismissed" } }),
      ...(watchId ? { watchId } : {}),
      ...(source ? { source } : {}),
      ...(closed === "active" ? { closedAt: null } : closed === "closed" ? { closedAt: { not: null } } : {}),
    },
    // 在招（closedAt 为空）优先，停招靠后；同组内已评分优先、其次按抓取时间兜底
    orderBy: [
      { closedAt: { sort: "asc", nulls: "first" } },
      { matchScore: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    take: 500,
    include: { watch: { select: { name: true } } },
  });
  return ok({ data });
});
