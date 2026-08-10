import { prisma } from "@careeros/db";
import { handler, ok, requireUser, ApiError } from "@/lib/api";

export const DELETE = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const alias = await prisma.skillAlias.findFirst({ where: { id, userId } });
  if (!alias) throw new ApiError(404, "not_found", "别名不存在");
  await prisma.skillAlias.delete({ where: { id } });
  return ok({ ok: true });
});
