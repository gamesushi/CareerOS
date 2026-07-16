import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";

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
  const session = await auth();
  if (!session?.user?.id) throw new ApiError(401, "unauthorized", "请先登录");
  return { userId: session.user.id, role: session.user.role ?? "user" };
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
