import Link from "next/link";
import { prisma } from "@careeros/db";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileHero } from "@/components/profile-hero";
import { Briefcase, FolderKanban, Sparkles, Trophy } from "lucide-react";
import { getT } from "@/lib/i18n/server";

function fmtMonth(d: Date) {
  return d.toISOString().slice(0, 7);
}

function dueLabel(d: Date): { text: string; tone: "over" | "today" | "soon" } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return { text: `逾期 ${-diff} 天`, tone: "over" };
  if (diff === 0) return { text: "今天", tone: "today" };
  return { text: `${diff} 天后`, tone: "soon" };
}

const STAGE_CN: Record<string, string> = {
  considering: "想投", applied: "已投递", screening: "筛选中", interview: "面试中", offer: "Offer", rejected: "已结束",
};

export default async function DashboardPage() {
  const t = await getT();
  const session = await getSession();
  const userId = session!.user.id;

  const [user, expCount, projCount, skillCount, achCount, experiences, projects, newMatches, todos] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, include: { careerProfile: true } }),
      prisma.careerExperience.count({ where: { userId, deletedAt: null } }),
      prisma.project.count({ where: { userId, deletedAt: null } }),
      prisma.skill.count({ where: { userId } }),
      prisma.achievement.count({ where: { userId } }),
      prisma.careerExperience.findMany({
        where: { userId, deletedAt: null },
        orderBy: { startDate: "desc" },
        take: 6,
        select: { id: true, company: true, title: true, startDate: true, endDate: true },
      }),
      prisma.project.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { id: true, name: true, role: true },
      }),
      // 今日新匹配：未下架、已评分、未处理（status=new）的高分发现岗位
      prisma.discoveredJob.findMany({
        where: { userId, takenDownAt: null, status: "new", matchScore: { not: null } },
        orderBy: [{ matchScore: "desc" }, { createdAt: "desc" }],
        take: 5,
        select: { id: true, title: true, company: true, url: true, matchScore: true },
      }),
      // 下一步待办：有 nextActionAt 的申请，按时间升序（逾期在前）
      prisma.application.findMany({
        where: { userId, nextActionAt: { not: null } },
        orderBy: { nextActionAt: "asc" },
        take: 6,
        select: { id: true, title: true, company: true, stage: true, nextAction: true, nextActionAt: true },
      }),
    ]);

  const isEmpty = expCount + projCount + skillCount + achCount === 0;

  if (isEmpty) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Card className="max-w-md text-center">
          <CardHeader>
            <CardTitle>{t("dashboard.emptyTitle")}</CardTitle>
            <CardDescription>
              {t("dashboard.emptyDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild>
              <Link href="/imports">{t("dashboard.emptyImport")}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/knowledge">{t("dashboard.emptyManual")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = [
    { label: t("dashboard.statExperiences"), value: expCount, icon: Briefcase, href: "/knowledge" },
    { label: t("dashboard.statProjects"), value: projCount, icon: FolderKanban, href: "/knowledge?tab=projects" },
    { label: t("dashboard.statSkills"), value: skillCount, icon: Sparkles, href: "/skills" },
    { label: t("dashboard.statAchievements"), value: achCount, icon: Trophy, href: "/knowledge?tab=achievements" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ProfileHero
        name={user?.name ?? t("app.defaultUser")}
        jobStatus={user?.jobStatus ?? "passive"}
        hasData={expCount + projCount > 0}
        profile={
          user?.careerProfile
            ? {
                headline: user.careerProfile.headline,
                summary: user.careerProfile.summary,
                careerTags: user.careerProfile.careerTags,
                careerLevel: user.careerProfile.careerLevel,
                yearsExperience: user.careerProfile.yearsExperience?.toString() ?? null,
                isStale: user.careerProfile.isStale,
              }
            : null
        }
      />

      {(newMatches.length > 0 || todos.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">今日新匹配</CardTitle>
              <Link href="/monitor" className="text-xs text-primary hover:underline">去监测 →</Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {newMatches.length === 0 && <p className="text-sm text-muted-foreground">暂无已评分的新岗位，去监测页点「按匹配度评分」。</p>}
              {newMatches.map((j) => (
                <a key={j.id} href={j.url ?? "#"} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent/40">
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      (j.matchScore ?? 0) >= 60 ? "bg-emerald-500/15 text-emerald-600" : (j.matchScore ?? 0) >= 30 ? "bg-amber-500/15 text-amber-600" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {Math.round(j.matchScore ?? 0)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{j.title}</span>
                    {j.company && <span className="text-muted-foreground"> · {j.company}</span>}
                  </span>
                </a>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">下一步待办</CardTitle>
              <Link href="/applications" className="text-xs text-primary hover:underline">去看板 →</Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {todos.length === 0 && <p className="text-sm text-muted-foreground">暂无待办。在申请详情里设「下一步」即可出现在这里。</p>}
              {todos.map((a) => {
                const due = a.nextActionAt ? dueLabel(a.nextActionAt) : null;
                return (
                  <Link key={a.id} href={`/applications/${a.id}`} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent/40">
                    {due && (
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          due.tone === "over" ? "bg-destructive/10 text-destructive" : due.tone === "today" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {due.text}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{a.nextAction ?? STAGE_CN[a.stage]}</span>
                      <span className="text-muted-foreground"> · {a.title}{a.company ? ` @ ${a.company}` : ""}</span>
                    </span>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href}>
            <Card className="transition-colors hover:bg-accent/40">
              <CardContent className="flex items-center gap-3 py-4">
                <Icon className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-semibold leading-none">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.timeline")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {experiences.map((e) => (
              <div key={e.id} className="flex items-baseline gap-3 text-sm">
                <span className="w-32 shrink-0 font-mono text-xs text-muted-foreground">
                  {fmtMonth(e.startDate)} ~ {e.endDate ? fmtMonth(e.endDate) : t("common.present")}
                </span>
                <span className="truncate">
                  <span className="font-medium">{e.company}</span>
                  <span className="text-muted-foreground"> · {e.title}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.recentProjects")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("dashboard.noProjectsPrefix")}<Link className="underline" href="/knowledge?tab=projects">{t("dashboard.noProjectsLink")}</Link>{t("dashboard.noProjectsSuffix")}
              </p>
            )}
            {projects.map((p) => (
              <div key={p.id} className="text-sm">
                <span className="font-medium">{p.name}</span>
                {p.role && <span className="text-muted-foreground"> · {p.role}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
