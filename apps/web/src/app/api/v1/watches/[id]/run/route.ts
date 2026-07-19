import { prisma } from "@careeros/db";
import { handler, ok, requireUser, ApiError } from "@/lib/api";
import { watchQueue } from "@/lib/queue";

export const POST = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const watch = await prisma.jobWatch.findFirst({ where: { id, userId } });
  if (!watch) throw new ApiError(404, "not_found", "监测任务不存在");
  await watchQueue.add("watch_poll", { watchId: id });
  return ok({ queued: true }, 202);
});
