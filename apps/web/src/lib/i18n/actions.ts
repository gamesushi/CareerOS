"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, normalizeLocale } from "./config";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** 设置界面语言：写 cookie 后刷新整棵路由树，使 <html lang> 与全部消息即时生效。 */
export async function setLocale(next: string): Promise<void> {
  const locale = normalizeLocale(next);
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
