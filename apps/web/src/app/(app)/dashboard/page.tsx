import Link from "next/link";
import { prisma } from "@careeros/db";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileHero } from "@/components/profile-hero";
import { Briefcase, FolderKanban, Sparkles, Trophy } from "lucide-react";

function fmtMonth(d: Date) {
  return d.toISOString().slice(0, 7);
}

export default async function DashboardPage() {
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
            <CardTitle>开始建立你的职业数据库</CardTitle>
            <CardDescription>
              简历只是视图，职业数据才是资产。先把经历沉淀进来。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild>
              <Link href="/imports">上传简历自动导入</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/knowledge">手动添加工作经历</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = [
    { label: "工作经历", value: expCount, icon: Briefcase, href: "/knowledge" },
    { label: "项目", value: projCount, icon: FolderKanban, href: "/knowledge?tab=projects" },
    { label: "技能", value: skillCount, icon: Sparkles, href: "/skills" },
    { label: "成果", value: achCount, icon: Trophy, href: "/knowledge?tab=achievements" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ProfileHero
        name={user?.name ?? "用户"}
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
            <CardTitle className="text-base">职业时间轴</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {experiences.map((e) => (
              <div key={e.id} className="flex items-baseline gap-3 text-sm">
                <span className="w-32 shrink-0 font-mono text-xs text-muted-foreground">
                  {fmtMonth(e.startDate)} ~ {e.endDate ? fmtMonth(e.endDate) : "至今"}
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
            <CardTitle className="text-base">最近项目</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.length === 0 && (
              <p className="text-sm text-muted-foreground">
                还没有项目，去<Link className="underline" href="/knowledge?tab=projects">知识库</Link>添加。
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
