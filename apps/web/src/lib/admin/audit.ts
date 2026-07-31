import { prisma, type AdminAction, type Prisma } from "@careeros/db";

export type ListAuditParams = { actorId?: string; targetId?: string; action?: AdminAction; page?: number; pageSize?: number };

/** 审计检索：按操作人/目标/动作过滤，倒序。只读。 */
export async function listAuditLogs(p: ListAuditParams) {
  const page = Math.max(1, p.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, p.pageSize ?? 30));
  const where: Prisma.AdminAuditLogWhereInput = {};
  if (p.actorId) where.actorId = p.actorId;
  if (p.targetId) where.targetId = p.targetId;
  if (p.action) where.action = p.action;

  const [rows, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { email: true, name: true } } },
    }),
    prisma.adminAuditLog.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}

/**
 * 记录一条管理操作审计。所有 /api/admin 写操作都应调用它（只增不改不删）。
 * before/after 传入前请先脱敏（勿写入明文密钥/证件号等）。
 */
export async function logAdminAction(params: {
  actorId: string;
  action: AdminAction;
  targetType: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string | null;
}): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      before: (params.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (params.after ?? undefined) as Prisma.InputJsonValue | undefined,
      reason: params.reason ?? null,
      ip: params.ip ?? null,
    },
  });
}
