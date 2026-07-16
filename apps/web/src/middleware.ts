import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 轻量登录 gate：只检查 session cookie 是否存在，真正的鉴权在 API 层（requireUser）。
// 避免在 middleware（edge runtime）里引入 Prisma。
const PUBLIC_PATHS = ["/login", "/api/auth"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const sessionCookie =
    req.cookies.get("authjs.session-token") ?? req.cookies.get("__Secure-authjs.session-token");
  if (!sessionCookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: { code: "unauthorized", message: "请先登录" } }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
