/**
 * 在反向代理（caddy）之后，req.url 拿到的是内网地址（http://web:3000 / localhost:3000），
 * 用它拼邮件里的链接会变成 localhost，用户点不开。必须按以下优先级还原公网 origin：
 *   1. X-Forwarded-Host + X-Forwarded-Proto（caddy 注入的真实公网 host / proto）
 *   2. 显式配置的环境变量 APP_URL / NEXT_PUBLIC_APP_URL
 *   3. 请求自身的 origin（本地 dev 直连、无代理时）
 *   4. 兜底生产域名 https://ucareeros.com
 */
export function getPublicOrigin(req: Request): string {
  const fwdHost = req.headers.get("x-forwarded-host");
  if (fwdHost) {
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${fwdHost}`;
  }
  const fromEnv = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  try {
    return new URL(req.url).origin;
  } catch {
    return "https://ucareeros.com";
  }
}
