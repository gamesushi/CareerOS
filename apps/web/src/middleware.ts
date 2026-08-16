import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getPublicOrigin } from "@/lib/origin";

// 轻量登录 gate：只检查 session cookie 是否有效，真正的鉴权在 API 层（requireUser）。
// 避免在 middleware（edge runtime）里引入 Prisma。
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/api/auth",
  "/api/v1/auth",
  "/tools",
  "/api/tools",
  "/c", // 公开公司主页 /c/<slug>：免登录可访问（雇主要能把链接发给候选人）
  "/api/public", // 公开只读资源（目前是公司 Logo），供上面那个页面加载
  "/welcome",
  "/terms",
  "/privacy",
];

function buildLoginUrl(req: NextRequest, pathname: string): URL {
  // 关键：反向代理（caddy）之后 req.nextUrl.host 是内网 upstream（localhost:3000 / web:3000），
  // 直接 clone 它会把浏览器重定向到 http://localhost:3000/login，登录后整段会话都被困在内网地址。
  // 必须改用公网 origin（X-Forwarded-Host/Proto 或 env 或兜底域名）拼登录地址，与邮件链接同源修复一致。
  const origin = getPublicOrigin(req);
  const url = new URL(origin);
  url.pathname = "/login";
  url.searchParams.set("callbackUrl", pathname);
  return url;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // 会话 cookie 名称取决于 Auth.js 是否以 https 写入：
  //  - 设了 AUTH_URL=https://… 或请求经 TLS 终止的反代（X-Forwarded-Proto=https）时，
  //    Auth.js 写入带 Secure 前缀的 __Secure-authjs.session-token；
  //  - 否则写入 authjs.session-token。
  // 反代之后 req.nextUrl.protocol 始终是内部 http，不能据此判断 secure，否则会去读
  // 错误的 cookie 名 → 永远读不到会话 → 登录成功后无限重定向到 /login（ERR_TOO_MANY_REDIRECTS）。
  // 因此两个名字都尝试，以浏览器实际带上的那个为准。
  const secureCookie = req.cookies.get("__Secure-authjs.session-token");
  const plainCookie = req.cookies.get("authjs.session-token");
  const cookie = secureCookie ?? plainCookie;
  const cookieName = cookie?.name ?? "authjs.session-token";
  const isPublic = pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // 若带有会话 cookie，先校验有效性。无效（如 AUTH_SECRET 轮换后旧会话 cookie 解密失败）
  // 则清除它，避免下游 Auth.js 抛 JWTSessionError 在控制台刷红字，并按「未登录」处理。
  if (cookie) {
    let valid = false;
    try {
      const token = await getToken({ req, secret: process.env.AUTH_SECRET, cookieName });
      valid = !!token;
    } catch {
      valid = false;
    }
    if (!valid) {
      if (isPublic) {
        // 公开页：从请求头剥离无效 cookie，避免下游 getSession 仍解码并报 JWTSessionError；
        // 同时在响应里清除，让浏览器彻底丢弃旧 cookie。
        const cookieHeader = req.headers.get("cookie") || "";
        const filtered = cookieHeader
          .split(";")
          .map((c) => c.trim())
          .filter((c) => !c.startsWith(`${cookieName}=`))
          .join("; ");
        const headers = new Headers(req.headers);
        if (filtered) headers.set("cookie", filtered);
        else headers.delete("cookie");
        const res = NextResponse.next({ request: { headers } });
        res.cookies.delete(cookieName);
        return res;
      }
      // 受保护页：清除无效 cookie 并重定向到登录页（浏览器跳转后不再携带旧 cookie）。
      const res = NextResponse.redirect(buildLoginUrl(req, pathname));
      res.cookies.delete(cookieName);
      return res;
    }
  }

  // 首页作为公开欢迎页（landing），无论登录与否都直接展示，不再重定向到 /login。
  if (isPublic) return NextResponse.next();

  if (!cookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "unauthorized", message: "请先登录" } },
        { status: 401 },
      );
    }
    return NextResponse.redirect(buildLoginUrl(req, pathname));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
