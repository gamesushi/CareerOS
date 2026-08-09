"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@careeros/db";
import { getSession } from "@/lib/auth";
import { LOCALE_COOKIE, normalizeLocale } from "./config";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * 设置界面语言：
 * 1. 写 cookie（即时生效、跨页面刷新）。
 * 2. 如果用户已登录，同步写入 User.locale（持久化到账号，换设备/清 cookie 后仍生效）。
 * 3. revalidate 整棵路由树，使 <html lang> 与全部消息即时生效。
 */
export async function setLocale(next: string): Promise<void> {
  const locale = normalizeLocale(next);
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });

  try {
    const session = await getSession();
    if (session?.user?.id) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { locale },
      });
    }
  } catch {
    // getSession 可能因旧 JWT 签名失效抛 JWTSessionError；cookie 已更新，不阻断 UI 切换。
  }

  revalidatePath("/", "layout");
}
