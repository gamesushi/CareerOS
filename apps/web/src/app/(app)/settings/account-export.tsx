"use client";

import { useT } from "@/lib/i18n/provider";

// 数据导出入口（PIPL 携带权）：链接到 /api/v1/account/export，GET 返回带 Content-Disposition 的 JSON 下载。
// 浏览器自动携带会话 cookie；GET 幂等，无 CSRF 风险。
export function AccountExport() {
  const t = useT();
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">{t("settings.exportTitle")}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{t("settings.exportDesc")}</p>
      <a
        href="/api/v1/account/export"
        className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
      >
        {t("settings.exportBtn")}
      </a>
    </section>
  );
}
