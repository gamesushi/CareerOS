import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getInsights } from "@/lib/insights";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

export default async function InsightsPage() {
  const t = await getT();
  const session = await getSession();
  const ins = await getInsights(session!.user.id);
  const stageCn = (s: string) => t(`apps.stage.${s}`);

  if (ins.total === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-semibold tracking-tight">{t("insights.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("insights.empty")} <Link href="/applications" className="text-primary hover:underline">{t("insights.emptyLink")}</Link>
        </p>
      </div>
    );
  }

  const appliedBase = ins.funnel.find((f) => f.stage === "applied")?.count ?? 0;
  const maxFunnel = Math.max(...ins.funnel.map((f) => f.count), 1);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("insights.title")}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("insights.summary", { total: ins.total, rejected: ins.rejected })}</p>
      </header>

      {ins.total < 10 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {t("insights.smallSample", { n: ins.total })}
        </div>
      )}

      {/* 申请漏斗 */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">{t("insights.funnel")}</h2>
        <div className="space-y-1.5 rounded-lg border p-4">
          {ins.funnel.map((f) => (
            <div key={f.stage} className="flex items-center gap-3 text-sm">
              <span className="w-16 shrink-0 text-muted-foreground">{stageCn(f.stage)}</span>
              <div className="h-4 flex-1 rounded bg-muted">
                <div className="h-4 rounded bg-primary/70" style={{ width: `${(f.count / maxFunnel) * 100}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right tabular-nums">{f.count}</span>
              <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {f.stage === "considering" || f.stage === "applied" || appliedBase === 0 ? "" : `${pct(f.count / appliedBase)}↘`}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("insights.funnelNote")}</p>
      </section>

      {/* 匹配分 ↔ 面试率 */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">{t("insights.scoreVsInterview")}</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">{t("insights.col.band")}</th>
                <th className="px-4 py-2 font-medium tabular-nums">{t("insights.col.count")}</th>
                <th className="px-4 py-2 font-medium tabular-nums">{t("insights.col.reached")}</th>
                <th className="px-4 py-2 font-medium">{t("insights.col.rate")}</th>
              </tr>
            </thead>
            <tbody>
              {ins.scoreBands.map((b) => (
                <tr key={b.band} className="border-t">
                  <td className="px-4 py-2">{t(`insights.band.${b.band}`)}</td>
                  <td className="px-4 py-2 tabular-nums">{b.total}</td>
                  <td className="px-4 py-2 tabular-nums">{b.reachedInterview}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded bg-muted">
                        <div className="h-2 rounded bg-emerald-500/70" style={{ width: `${b.interviewRate * 100}%` }} />
                      </div>
                      <span className="tabular-nums text-xs">{b.total ? pct(b.interviewRate) : "—"}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">{t("insights.scoreNote")}</p>
      </section>

      {/* 简历表现 A/B */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">{t("insights.resumeAB")}</h2>
        {ins.byResume.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t("insights.resumeEmpty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">{t("insights.col.resume")}</th>
                  <th className="px-4 py-2 font-medium tabular-nums">{t("insights.col.sent")}</th>
                  <th className="px-4 py-2 font-medium tabular-nums">{t("insights.col.reached")}</th>
                  <th className="px-4 py-2 font-medium">{t("insights.col.rate")}</th>
                </tr>
              </thead>
              <tbody>
                {ins.byResume.map((r) => (
                  <tr key={r.title} className="border-t">
                    <td className="px-4 py-2">{r.title}</td>
                    <td className="px-4 py-2 tabular-nums">{r.total}</td>
                    <td className="px-4 py-2 tabular-nums">{r.reachedInterview}</td>
                    <td className="px-4 py-2 tabular-nums">{pct(r.interviewRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 当前阶段分布 */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">{t("insights.currentStage")}</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ins.currentStage).map(([stage, n]) => (
            <span key={stage} className="rounded-md border px-2.5 py-1 text-sm">
              {stageCn(stage)} <span className="font-semibold tabular-nums">{n}</span>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
