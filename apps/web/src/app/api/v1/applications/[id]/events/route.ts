import { z } from "zod";
import { prisma } from "@careeros/db";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";

const noteInput = z.object({ note: z.string().min(1).max(2000) });

// 向申请时间线追加一条备注事件。
export const POST = handler(async (req, ctx) => {
  const { userId } = await requireUser();
  const { id } = await ctx.params;
  const app = await prisma.application.findFirst({ where: { id, userId }, select: { id: true } });
  if (!app) throw new ApiError(404, "not_found", "申请不存在");
  const { note } = await parseBody(req, noteInput);
  const ev = await prisma.applicationEvent.create({ data: { applicationId: id, kind: "note", note } });
  return ok({ data: ev });
});
