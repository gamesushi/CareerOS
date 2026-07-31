import { prisma } from "@careeros/db";
import { handler, requireUser } from "@/lib/api";

export const dynamic = "force-dynamic";

// PIPL 携带权（数据可携）：导出本人全部数据副本。GET 触发，浏览器按 Content-Disposition 下载 JSON。
// 被封/已删账号由 requireUser 拦截（bannedAt→403，deletedAt→401），不会拿到数据。
export const GET = handler(async () => {
  const { userId } = await requireUser();

  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      locale: true,
      region: true,
      mobile: true,
      preferredCity: true,
      workAuthStatus: true,
      snsLinks: true,
      languages: true,
      jobStatus: true,
      privacy: true,
      createdAt: true,
      updatedAt: true,
      tosAcceptedAt: true,
      tosVersion: true,
    },
  });

  const [loginHistory, content] = await Promise.all([
    prisma.loginLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { method: true, success: true, reason: true, ip: true, createdAt: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        _count: {
          select: {
            experiences: true,
            projects: true,
            skills: true,
            achievements: true,
            educations: true,
            honors: true,
            workLogs: true,
            resumeImports: true,
            jds: true,
            resumes: true,
            applications: true,
            jobWatches: true,
            discoveredJobs: true,
            connectionsFrom: true,
          },
        },
      },
    }),
  ]);

  const payload = {
    schema: "careeros.account.export/v1",
    exportedAt: new Date().toISOString(),
    account,
    loginHistory,
    contentSummary: content?._count ?? {},
  };

  const filename = `careeros-data-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
