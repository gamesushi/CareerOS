// 消息目录加载器（服务端）。静态映射保证 Next.js 打包时能 tree-shake / 按需引入。
import type { Locale } from "./config";
import { DEFAULT_LOCALE } from "./config";

import zhCN from "@/messages/zh-CN.json";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import zhTW from "@/messages/zh-TW.json";
import ko from "@/messages/ko.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import es from "@/messages/es.json";
import pt from "@/messages/pt.json";
import ru from "@/messages/ru.json";
import it from "@/messages/it.json";

export type Messages = Record<string, string>;

const CATALOGS: Record<Locale, Messages> = {
  "zh-CN": zhCN as Messages,
  en: en as Messages,
  ja: ja as Messages,
  "zh-TW": zhTW as Messages,
  ko: ko as Messages,
  fr: fr as Messages,
  de: de as Messages,
  es: es as Messages,
  pt: pt as Messages,
  ru: ru as Messages,
  it: it as Messages,
};

/** 取某语言的完整消息目录（缺失键由源语言 zh-CN 兜底）。 */
export function getMessages(locale: Locale): Messages {
  const base = CATALOGS[DEFAULT_LOCALE];
  const target = CATALOGS[locale] ?? base;
  // 合并：目标语言优先，缺失键回退到源语言，保证界面不会出现空白 key。
  return { ...base, ...target };
}
