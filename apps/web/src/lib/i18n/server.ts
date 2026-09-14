import { cookies } from "next/headers";
import { prisma } from "@careeros/db";
import { getSession } from "@/lib/auth";
import { LOCALE_COOKIE, isLocale, DEFAULT_LOCALE, type Locale } from "./config";
import { getMessages } from "./messages";

/**
 * 服务端读取当前 locale。
 * 优先级：
 * 1. 已登录用户的显式设置（User.locale），设置页会同步更新到 cookie。
 * 2. LOCALE_COOKIE（用户此前手动切换过语言）。
 * 3. DEFAULT_LOCALE（英文）——主站默认语言，未识别到任何用户语言偏好时回退。
 *
 * 说明：不再按浏览器 Accept-Language 自动协商语言。主站以英文为默认，
 * 仅当用户已显式选择（账号设置或 cookie）时才切换，避免「中文浏览器默认中文」。
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const cookieValue = store.get(LOCALE_COOKIE)?.value;

  // 已登录用户：以 DB 中的显式语言设置为准。
  // 设置页切换语言时会同时写入 cookie 和 User.locale，因此通常 cookie 已是最新值；
  // 这里读 DB 是为了在换设备/清除 cookie 后仍能按用户设置渲染。
  try {
    const session = await getSession();
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { locale: true },
      });
      if (user?.locale && isLocale(user.locale)) {
        return user.locale;
      }
    }
  } catch {
    // getSession 可能因旧 JWT 签名失效抛 JWTSessionError；此时按未登录处理即可。
  }

  if (isLocale(cookieValue)) {
    return cookieValue;
  }

  return DEFAULT_LOCALE;
}

type TParams = Record<string, string | number>;

/** 服务端翻译函数（用于 Server Component）。返回 t(key, params)。 */
export async function getT(): Promise<(key: string, params?: TParams) => string> {
  const locale = await getLocale();
  const messages = getMessages(locale);
  return (key: string, params?: TParams) => {
    const template = messages[key];
    if (template === undefined) return key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (m, name: string) =>
      name in params ? String(params[name]) : m,
    );
  };
}
