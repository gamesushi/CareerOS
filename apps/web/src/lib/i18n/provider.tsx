"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import type { Locale } from "./config";
import type { Messages } from "./messages";

type TParams = Record<string, string | number>;

interface I18nContextValue {
  locale: Locale;
  messages: Messages;
  t: (key: string, params?: TParams) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  );
}

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const t = useCallback(
    (key: string, params?: TParams) => {
      const template = messages[key];
      if (template === undefined) return key; // 缺失键回退为 key 本身，便于发现遗漏
      return interpolate(template, params);
    },
    [messages],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, messages, t }),
    [locale, messages, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}

/** 便捷 hook：只取翻译函数。 */
export function useT(): I18nContextValue["t"] {
  return useI18n().t;
}

export function useLocale(): Locale {
  return useI18n().locale;
}
