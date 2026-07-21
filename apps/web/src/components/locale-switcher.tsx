"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";
import { LOCALES } from "@/lib/i18n/config";
import { setLocale } from "@/lib/i18n/actions";
import { useLocale, useT } from "@/lib/i18n/provider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/** 语言切换器。写 cookie 后由 server action revalidate 整树，无需刷新页面。 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useT();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={locale}
      onValueChange={(v) => startTransition(() => void setLocale(v))}
    >
      <SelectTrigger className={className} disabled={pending} aria-label={t("settings.language")}>
        <Languages className="size-4 opacity-70" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((l) => (
          <SelectItem key={l.code} value={l.code}>
            {l.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
