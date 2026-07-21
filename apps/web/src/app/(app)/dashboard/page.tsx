import Link from "next/link";
import { prisma } from "@careeros/db";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileHero } from "@/components/profile-hero";
import { Briefcase, FolderKanban, Sparkles, Trophy } from "lucide-react";
import { getT } from "@/lib/i18n/server";

function fmtMonth(d: Date) {
  return d.toISOString().slice(0, 7);
}

export default async function DashboardPage() {
  const t = await getT();
  const session = await auth();
  const userId = session!.user.id;

  const [user, expCount, projCount, skillCount, achCount, experiences, projects] =
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
