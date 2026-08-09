import { cookies, headers } from "next/headers";
import { prisma } from "@careeros/db";
import { getSession } from "@/lib/auth";
import { LOCALE_COOKIE, normalizeLocale, isLocale, negotiateLocale, type Locale } from "./config";
import { getMessages } from "./messages";

/**
 * 服务端读取当前 locale。
 * 优先级：
 * 1. 已登录用户的显式设置（User.locale），设置页会同步更新到 cookie。
 * 2. LOCALE_COOKIE（未登录或用户未显式设置时使用）。
 * 3. 浏览器 Accept-Language 头协商出的最佳受支持语言。
 * 4. DEFAULT_LOCALE。
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

  const acceptLanguage = (await headers()).get("accept-language");
  return negotiateLocale(acceptLanguage);
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
