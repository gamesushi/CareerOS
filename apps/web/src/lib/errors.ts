/**
 * API 错误类型。刻意独立成文件而不是留在 lib/api.ts —— 后者 import 了 lib/auth
 * （进而是 next-auth → next/server），任何只想抛个 403 的纯查询模块都会被迫拖进
 * 整个鉴权栈，在 node 环境的集成测试里直接 import 失败。
 */
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
