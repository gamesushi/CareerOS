// 进程内滑动窗口限流（用于无用户上下文的公开端点，如免登录工具）。
// 注意：单进程内存，多实例部署下非全局精确——仅作基础防刷，严格限流需 Redis。

const buckets = new Map<string, number[]>();

export function ipRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    buckets.set(key, arr);
    return true;
  }
  arr.push(now);
  buckets.set(key, arr);
  return false;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
