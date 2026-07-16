import { prisma } from "@careeros/db";
import { skillEvidenceInput } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";

export const GET = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const skill = await prisma.skill.findFirst({ where: { id, userId } });
  if (!skill) throw new ApiError(404, "not_found", "技能不存在");
  const data = await prisma.skillEvidence.findMany({
    where: { skillId: id },
    orderBy: { createdAt: "desc" },
  });
  return ok({ data });
});

export const POST = handler(async (req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const skill = await prisma.skill.findFirst({ where: { id, userId } });
  if (!skill) throw new ApiError(404, "not_found", "技能不存在");

  const input = await parseBody(req, skillEvidenceInput);
  if (input.sourceType !== "external" && !input.sourceId) {
    throw new ApiError(400, "validation_error", "非 external 证据必须指定 sourceId");
  }

  const created = await prisma.skillEvidence.create({
    data: {
      skillId: id,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      note: input.note,
      url: input.url ?? null,
      weight: input.weight,
    },
  });
  // 证据日期滚动 last_used_at（Sprint 3 起由证据来源实体的时间驱动，先用当前时间兜底）
  await prisma.skill.update({ where: { id }, data: { lastUsedAt: new Date() } });
  return ok(created, 201);
});
