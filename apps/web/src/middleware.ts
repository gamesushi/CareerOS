import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

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
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("callbackUrl", pathname);
  return url;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const secure = req.nextUrl.protocol === "https:";
  const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
  const cookie = req.cookies.get(cookieName);
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
