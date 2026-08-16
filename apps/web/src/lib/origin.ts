/**
 * 在反向代理（caddy）之后，req.url 拿到的是内网地址（http://web:3000 / localhost:3000），
 * 用它拼邮件里的链接会变成 localhost，用户点不开。必须按以下优先级还原公网 origin：
 *   1. X-Forwarded-Host + X-Forwarded-Proto（caddy 注入的真实公网 host / proto）
 *   2. 显式配置的环境变量（APP_URL / NEXT_PUBLIC_APP_URL / NEXTAUTH_URL / AUTH_URL）
 *   3. 请求自身的 origin（仅本地 dev 直连、无代理时；生产环境绝不使用，避免泄漏内网地址）
 *   4. 兜底生产域名 https://ucareeros.com
 *
 * 关键：生产环境（NODE_ENV=production）下第 3 步直接跳过，确保邮件链接永远指向公网域名，
 * 不会回退到 localhost / web:3000 这类内网地址。
 */
export function getPublicOrigin(req: Request): string {
  const fwdHost = req.headers.get("x-forwarded-host");
  if (fwdHost) {
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${fwdHost}`;
  }

  const fromEnv =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  // 本地开发直连（无代理）才允许用请求自身 origin；生产环境一律走下方兜底域名。
  if (process.env.NODE_ENV !== "production") {
    try {
      return new URL(req.url).origin;
    } catch {
      /* fall through */
    }
  }

  return "https://ucareeros.com";
}
