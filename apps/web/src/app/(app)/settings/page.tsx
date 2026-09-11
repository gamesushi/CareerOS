import { redirect } from "next/navigation";
import { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { getT, getLocale } from "@/lib/i18n/server";
import { prisma } from "@careeros/db";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { AccountDanger } from "./account-danger";
import { AccountExport } from "./account-export";
import { EmployerRole } from "./employer-role";
import { TokenCard } from "./token-card";
import { getTokenStatus, TIERS } from "@/lib/tokens";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("settings.pageTitle") };
}

// 账号设置：展示近期登录（登录审计透明化），并提供自助注销入口。
export default async function SettingsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const t = await getT();
  const locale = await getLocale();

  const [recent, me, tokStatus, prices, transactions] = await Promise.all([
    prisma.loginLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    // 角色查 DB：session 里的 role 是登录快照，切换后不重登会显示过期状态
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    // Token 额度：首次访问惰性创建并发放免费额度（getTokenStatus 内部 upsert）
    getTokenStatus(userId),
    prisma.tokenPrice.findMany({ orderBy: { model: "asc" } }),
    prisma.tokenTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        delta: true,
        kind: true,
        refType: true,
        balanceAfter: true,
        note: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{session.user.email}</p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t("settings.recentLogins")}</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("settings.noLogins")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {recent.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span className="tabular-nums text-muted-foreground">
                  {new Date(l.createdAt).toLocaleString(locale)}
                </span>
                <span className="capitalize">{l.method}</span>
                <span className={l.success ? "text-green-600" : "text-red-600"}>
                  {l.success ? t("settings.loginSuccess") : t("settings.loginFailed")}
                </span>
                <span className="max-w-[10rem] truncate text-xs text-muted-foreground">
                  {l.ip ?? t("settings.unknownIp")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t("settings.language")}</h2>
        <LocaleSwitcher className="w-full max-w-xs" />
      </section>

      <EmployerRole role={me?.role ?? "user"} />

      <TokenCard
        balance={tokStatus.balance}
        tier={tokStatus.tier}
        tierLabel={TIERS[tokStatus.tier].label}
        freeQuota={tokStatus.freeQuota}
        dailyCap={tokStatus.dailyCap}
        dailyUsed={tokStatus.dailyUsed}
        dailyRemaining={Math.max(tokStatus.dailyCap - tokStatus.dailyUsed, 0)}
        prices={prices.map((p) => ({
          model: p.model,
          label: p.label,
          inPer1k: Number(p.inPer1k),
          outPer1k: Number(p.outPer1k),
          currency: p.currency,
        }))}
        transactions={transactions.map((t) => ({
          id: t.id,
          delta: t.delta,
          kind: t.kind,
          refType: t.refType,
          balanceAfter: t.balanceAfter,
          note: t.note,
          createdAt: t.createdAt.toISOString(),
        }))}
      />

      <AccountExport />

      <AccountDanger />
    </div>
  );
}
