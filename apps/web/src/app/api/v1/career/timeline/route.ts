import { prisma } from "@careeros/db";
import { handler, ok, requireUser } from "@/lib/api";

// Dashboard 时间轴：经历与项目按时间合并
export const GET = handler(async () => {
  const { userId } = await requireUser();
  const [experiences, projects] = await Promise.all([
    prisma.careerExperience.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, company: true, title: true, startDate: true, endDate: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.project.findMany({
      where: { userId, deletedAt: null, startDate: { not: null } },
      select: { id: true, name: true, role: true, startDate: true, endDate: true, experienceId: true },
      orderBy: { startDate: "desc" },
    }),
  ]);

  const items = [
    ...experiences.map((e) => ({
      type: "experience" as const,
      id: e.id,
      label: `${e.company} · ${e.title}`,
      startDate: e.startDate,
      endDate: e.endDate,
    })),
    ...projects.map((p) => ({
      type: "project" as const,
      id: p.id,
      label: p.role ? `${p.name}（${p.role}）` : p.name,
      startDate: p.startDate!,
      endDate: p.endDate,
      experienceId: p.experienceId,
    })),
  ].sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

  return ok({ data: items });
});
