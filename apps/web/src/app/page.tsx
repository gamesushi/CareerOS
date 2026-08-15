import type { Metadata } from "next";
import Link from "next/link";
import { getPublicStats } from "@/lib/stats";
import { StatsCounter } from "@/app/welcome/stats-counter";
import { getT, getLocale } from "@/lib/i18n/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "uCareerOS · 职业知识库驱动的求职操作系统",
  description:
    "uCareerOS 聚合中国、美国、日本的招聘源，用 AI 帮你匹配岗位、识别诈骗、生成多地区简历，并把所有洞察沉淀为可累积的职业知识库。",
};

// 公开展示页：统计数字每小时重新聚合一次（ISR），兼顾"最新"与数据库压力。
export const revalidate = 3600;

const FEATURE_KEYS = [
  { titleKey: "landing.feat1.title", descKey: "landing.feat1.desc", tags: ["CN", "US", "JP"], href: "/tools/leaderboard" },
  { titleKey: "landing.feat2.title", descKey: "landing.feat2.desc", tags: ["免费工具"], href: "/tools/matcher" },
  { titleKey: "landing.feat3.title", descKey: "landing.feat3.desc", tags: ["免费工具"], href: "/tools/scam-checker" },
  { titleKey: "landing.feat4.title", descKey: "landing.feat4.desc", tags: ["免费工具"], href: "/tools/leaderboard" },
  { titleKey: "landing.feat5.title", descKey: "landing.feat5.desc", tags: ["差异化"], href: "#regions" },
  { titleKey: "landing.feat6.title", descKey: "landing.feat6.desc", tags: ["护城河"], href: "#" },
] as const;

const REGIONS = [
  {
    flag: "🇨🇳", nameKey: "landing.region.cn.name",
    points: [
      "landing.region.cn.p1",
      "landing.region.cn.p2",
      "landing.region.cn.p3",
    ],
  },
  {
    flag: "🇺🇸", nameKey: "landing.region.us.name",
    points: [
      "landing.region.us.p1",
      "landing.region.us.p2",
      "landing.region.us.p3",
    ],
  },
  {
    flag: "🇯🇵", nameKey: "landing.region.jp.name",
    points: [
      "landing.region.jp.p1",
      "landing.region.jp.p2",
      "landing.region.jp.p3",
    ],
  },
] as const;

export default async function WelcomePage() {
  const t = await getT();
  const locale = await getLocale();
  const stats = await getPublicStats();
  const dateLocale = locale === "ja" ? "ja-JP" : locale === "en" ? "en-US" : "zh-CN";
  const updatedAt = new Date(stats.generatedAt).toLocaleDateString(dateLocale);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="font-semibold">
            uCareerOS
          </Link>
          <nav className="flex items-center gap-3 text-sm text-muted-foreground">
            <Link href="/tools" className="hover:text-foreground">
              {t("landing.navTools")}
            </Link>
            <Link href="/login" className="hover:text-foreground">
              {t("landing.navApp")}
            </Link>
            <LocaleSwitcher className="h-9 w-auto" />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
        {/* Hero */}
        <section className="space-y-6 py-8 text-center">
          <Badge variant="secondary" className="mx-auto">
            {t("landing.tagline")}
          </Badge>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            {t("landing.heroTitle")}
          </h1>
          <p className="mx-auto max-w-2xl text-balance text-lg text-muted-foreground">
            {t("landing.heroDesc")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">{t("landing.ctaPrimary")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/tools">{t("landing.ctaSecondary")}</Link>
            </Button>
          </div>
        </section>

        {/* 统计 */}
        <section className="grid grid-cols-1 gap-4 py-8 sm:grid-cols-3">
          <Card>
            <CardContent className="space-y-1 p-6 text-center">
              <div className="text-4xl font-bold tabular-nums">
                <StatsCounter value={stats.users} />
              </div>
              <p className="text-sm text-muted-foreground">{t("landing.statUsers")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 p-6 text-center">
              <div className="text-4xl font-bold tabular-nums">
                <StatsCounter value={stats.companies} />
              </div>
              <p className="text-sm text-muted-foreground">{t("landing.statCompanies")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 p-6 text-center">
              <div className="text-4xl font-bold tabular-nums">
                <StatsCounter value={stats.jobs} />
              </div>
              <p className="text-sm text-muted-foreground">{t("landing.statJobs")}</p>
            </CardContent>
          </Card>
        </section>
        <p className="pb-4 text-center text-xs text-muted-foreground">
          {t("landing.statNote", { date: updatedAt })}
        </p>

        {/* 功能 */}
        <section className="space-y-6 py-8">
          <h2 className="text-center text-2xl font-semibold tracking-tight">{t("landing.sectionFeatures")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_KEYS.map((f) => (
              <Card key={f.titleKey} className="flex flex-col transition-colors hover:border-foreground/30">
                <CardHeader>
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {f.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <CardTitle className="text-lg">{t(f.titleKey)}</CardTitle>
                  <CardDescription>{t(f.descKey)}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto pt-0">
                  {f.href.startsWith("/") ? (
                    <Link
                      href={f.href}
                      className="text-sm font-medium text-foreground/80 underline-offset-4 hover:underline"
                    >
                      {t("landing.featLink")}
                    </Link>
                  ) : (
                    <a
                      href={f.href}
                      className="text-sm font-medium text-foreground/80 underline-offset-4 hover:underline"
                    >
                      {t("landing.featLink")}
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* 多地区 */}
        <section id="regions" className="space-y-6 py-8">
          <h2 className="text-center text-2xl font-semibold tracking-tight">{t("landing.regionTitle")}</h2>
          <p className="mx-auto max-w-2xl text-center text-sm text-muted-foreground">
            {t("landing.regionDesc")}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {REGIONS.map((r) => (
              <Card key={r.nameKey}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span className="text-2xl">{r.flag}</span>
                    {t(r.nameKey)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {r.points.map((p, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-foreground/40">•</span>
                        <span>{t(p)}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-10 text-center">
          <div className="mx-auto max-w-xl space-y-4 rounded-2xl border bg-muted/30 p-8">
            <h3 className="text-xl font-semibold">{t("landing.ctaTitle")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("landing.ctaDesc")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild>
                <Link href="/login">{t("landing.ctaPrimary")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/tools">{t("landing.ctaSecondary")}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="space-y-2 border-t py-6 text-center text-xs text-muted-foreground">
        <div>{t("landing.footer")}</div>
        <div className="space-x-3">
          <Link href="/terms" className="underline-offset-4 hover:text-foreground hover:underline">
            {t("landing.footerTerms")}
          </Link>
          <Link href="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
            {t("landing.footerPrivacy")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
