import { prisma } from "@careeros/db";
import { discoveredJobStatusInput } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";

export const PUT = handler(async (req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const job = await prisma.discoveredJob.findFirst({ where: { id, userId } });
  if (!job) throw new ApiError(404, "not_found", "岗位不存在");
  const input = await parseBody(req, discoveredJobStatusInput);
  const updated = await prisma.discoveredJob.update({ where: { id }, data: { status: input.status } });
  return ok(updated);
});
