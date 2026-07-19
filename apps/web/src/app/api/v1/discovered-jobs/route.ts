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
      ...(status && status !== "all" ? { status: status as DiscoveredJobStatus } : { status: { not: "dismissed" } }),
      ...(watchId ? { watchId } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    include: { watch: { select: { name: true } } },
  });
  return ok({ data });
});
