import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale, type Locale } from "./config";
import { getMessages } from "./messages";

/** 服务端读取当前 locale（来自 cookie，缺省回退到默认语言）。 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return normalizeLocale(store.get(LOCALE_COOKIE)?.value);
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
