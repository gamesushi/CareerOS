import { prisma, Prisma, type UserRole } from "@careeros/db";

export type UserStatus = "active" | "deleted" | "banned";
export type ListUsersParams = { q?: string; role?: UserRole; status?: UserStatus; page?: number; pageSize?: number };

export type UserRow = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  deletedAt: string | null;
  bannedAt: string | null;
};

function buildWhere(p: ListUsersParams): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};
  if (p.q) {
    where.OR = [
      { email: { contains: p.q, mode: "insensitive" } },
      { name: { contains: p.q, mode: "insensitive" } },
    ];
  }
  if (p.role) where.role = p.role;
  if (p.status === "active") Object.assign(where, { deletedAt: null, bannedAt: null });
  else if (p.status === "deleted") where.deletedAt = { not: null };
  else if (p.status === "banned") where.bannedAt = { not: null };
  return where;
}

export async function listUsers(p: ListUsersParams): Promise<{ rows: UserRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, p.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, p.pageSize ?? 20));
  const where = buildWhere(p);

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, email: true, name: true, role: true, createdAt: true, deletedAt: true, bannedAt: true },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      deletedAt: r.deletedAt?.toISOString() ?? null,
      bannedAt: r.bannedAt?.toISOString() ?? null,
    })),
    total,
    page,
    pageSize,
  };
}

export async function getUserDetail(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      locale: true,
      region: true,
      jobStatus: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      bannedAt: true,
      weknoraApiKey: true, // 仅用于判断是否已配置（页面脱敏展示），不回显
      _count: {
        select: { resumes: true, jds: true, jobMatches: true, discoveredJobs: true, workLogs: true, aiRuns: true },
      },
    },
  });
}
