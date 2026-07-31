import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@careeros/db";
import { getSession } from "@/lib/auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** 取当前登录用户 id，未登录抛 401。所有业务查询必须带上返回的 userId 做行级隔离。 */
export async function requireUser(): Promise<{ userId: string; role: string }> {
  const session = await getSession();
  if (!session?.user?.id) throw new ApiError(401, "unauthorized", "请先登录");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, deletedAt: true, bannedAt: true },
  });
  if (user?.bannedAt) throw new ApiError(403, "banned", "账号已被封禁");
  if (user?.deletedAt) throw new ApiError(401, "unauthorized", "账号不可用，请重新登录");
  if (!user) {
    // 兜底：JWT 里的 user.id 在 DB 中查不到（典型场景：DB 被 reset/迁移/手动清理）。
    // - dev 模式：按 session.email 重新 upsert 创建用户，保证 session ↔ DB 一致，避免误用他人记录。
    // - 生产：直接 401，让用户重新登录（authorize 会重新落库）。
    if (process.env.AUTH_DEV_CREDENTIALS === "true") {
      const email = session.user.email?.trim().toLowerCase();
      if (email && email.includes("@")) {
        const devUser = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, name: email.split("@")[0] },
        });
        return { userId: devUser.id, role: session.user.role ?? "user" };
      }
    }
    throw new ApiError(401, "unauthorized", "用户账号不存在，请重新登录");
  }
  return { userId: session.user.id, role: session.user.role ?? "user" };
}

/**
 * 复核「有效管理员」：role=admin 且未被软删。
 * 角色一律以 DB 为准，不信任 JWT 里的 session.role（改角色后不重登会过期）——
 * 这样管理员被降权（admin→user）能即时失去后台访问。
 */
export async function isActiveAdmin(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, deletedAt: true } });
  return !!u && !u.deletedAt && u.role === "admin";
}

/**
 * 管理接口门禁：非管理员抛 403。
 * 管理员是唯一被授权跨用户读写、绕过行级隔离的角色，故所有 /api/admin 路由入口必须先过这里。
 */
export async function requireAdmin(): Promise<{ userId: string }> {
  const { userId } = await requireUser();
  if (!(await isActiveAdmin(userId))) throw new ApiError(403, "forbidden", "需要管理员权限");
  return { userId };
}

export async function parseBody<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "请求体不是合法 JSON");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError(400, "validation_error", "参数校验失败", result.error.flatten());
  }
  return result.data;
}

/** route handler 包装：统一错误响应格式 */
export function handler(fn: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json(
          { error: { code: e.code, message: e.message, details: e.details ?? null } },
          { status: e.status },
        );
      }
      console.error("[api]", e);
      return NextResponse.json(
        { error: { code: "internal", message: "服务器内部错误" } },
        { status: 500 },
      );
    }
  };
}

export const toDate = (s: string | null | undefined) => (s ? new Date(`${s}T00:00:00Z`) : null);

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
