"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT, useLocale } from "@/lib/i18n/provider";
import type { LeaderboardBy, LeaderboardResult } from "@/lib/leaderboard";

const localeMap: Record<string, string> = {
  ja: "ja-JP",
  en: "en-US",
  "zh-CN": "zh-CN",
};

export function LeaderboardClient({
  initialBy,
  initialRemote,
  initialData,
}: {
  initialBy: LeaderboardBy;
  initialRemote: boolean;
  initialData: LeaderboardResult;
}) {
  const t = useT();
  const locale = useLocale();
  const [by, setBy] = useState<LeaderboardBy>(initialBy);
  const [remote, setRemote] = useState<boolean>(initialRemote);
  const [data, setData] = useState<LeaderboardResult>(initialData);
  const [loading, setLoading] = useState(false);

  async function refresh(nextBy: LeaderboardBy, nextRemote: boolean) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tools/leaderboard?by=${nextBy}&remote=${nextRemote ? 1 : 0}&limit=50`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("fetch failed");
      setData(await res.json());
    } catch {
      // 失败时保留旧数据，不阻断浏览
    } finally {
      setLoading(false);
    }
  }

  function switchBy(next: LeaderboardBy) {
    if (next === by) return;
    setBy(next);
    refresh(next, remote);
  }

  function toggleRemote() {
    const next = !remote;
    setRemote(next);
    refresh(by, next);
  }

  const max = data.items.reduce((m, it) => Math.max(m, it.count), 0) || 1;
  const titleLabel = by === "company" ? t("toolsPages.leaderboard.titleCompany") : t("toolsPages.leaderboard.titleSource");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("toolsPages.leaderboard.h1")}</h1>
        <p className="text-muted-foreground">{t("toolsPages.leaderboard.subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border p-0.5">
          <button
            type="button"
            onClick={() => switchBy("company")}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              by === "company" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            {t("toolsPages.leaderboard.byCompany")}
          </button>
          <button
            type="button"
            onClick={() => switchBy("source")}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              by === "source" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            {t("toolsPages.leaderboard.bySource")}
          </button>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={remote} onChange={toggleRemote} />
          {t("toolsPages.leaderboard.remoteOnlyLabel")}
        </label>
        {loading && <Loader2 className="size-4 animate-spin" />}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">
              {titleLabel} Top {data.items.length}
            </CardTitle>
            <Badge variant="outline">{t("toolsPages.leaderboard.total", { n: data.total })}</Badge>
          </div>
          <CardDescription>
            {data.remoteOnly
              ? t("toolsPages.leaderboard.descRemote")
              : t("toolsPages.leaderboard.descAll")}
            {" · "}
            {t("toolsPages.leaderboard.updated")}
            {new Date(data.generatedAt).toLocaleString(localeMap[locale] ?? "ja-JP")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("toolsPages.leaderboard.empty")}</p>
          ) : (
            <ol className="space-y-2">
              {data.items.map((it, i) => (
                <li key={it.name} className="flex items-center gap-3">
                  <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{it.name}</span>
                      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{it.count}</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.round((it.count / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">{data.dedupNote}</p>
    </div>
  );
}
