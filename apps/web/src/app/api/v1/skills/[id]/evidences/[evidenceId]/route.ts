import { prisma } from "@careeros/db";
import { handler, ok, requireUser, ApiError } from "@/lib/api";

export const DELETE = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id, evidenceId } = await params;
  const evidence = await prisma.skillEvidence.findFirst({
    where: { id: evidenceId, skillId: id, skill: { userId } },
  });
  if (!evidence) throw new ApiError(404, "not_found", "证据不存在");
  await prisma.skillEvidence.delete({ where: { id: evidenceId } });
  return ok({ deleted: true });
});
