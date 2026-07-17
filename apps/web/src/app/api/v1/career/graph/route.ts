import { prisma } from "@careeros/db";
import { handler, ok, requireUser } from "@/lib/api";

// 职业图谱（docs/design/01 §3.4）：关系表即边，无图数据库。
// 边类型：WORKED_AT / PARTICIPATED_IN / HAS_SKILL / HAS_ACHIEVEMENT / EVIDENCED_BY

export const GET = handler(async () => {
  const { userId } = await requireUser();
  const [user, experiences, projects, skills, achievements, projectSkills, evidences] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { careerProfile: true } }),
    prisma.careerExperience.findMany({ where: { userId, deletedAt: null }, orderBy: { startDate: "desc" } }),
    prisma.project.findMany({ where: { userId, deletedAt: null } }),
    prisma.skill.findMany({ where: { userId } }),
    prisma.achievement.findMany({ where: { userId } }),
    prisma.projectSkill.findMany({ where: { project: { userId } } }),
    prisma.skillEvidence.findMany({ where: { skill: { userId } } }),
  ]);

  const nodes = [
    { id: `user`, type: "user", label: user.name, meta: { headline: user.careerProfile?.headline } },
    ...experiences.map((e) => ({
      id: `exp:${e.id}`, type: "experience",
      label: `${e.company}`, meta: { title: e.title, entityId: e.id },
    })),
    ...projects.map((p) => ({ id: `proj:${p.id}`, type: "project", label: p.name, meta: { entityId: p.id } })),
    ...skills.map((s) => ({ id: `skill:${s.id}`, type: "skill", label: s.name, meta: { level: s.level, entityId: s.id } })),
    ...achievements.map((a) => ({ id: `ach:${a.id}`, type: "achievement", label: a.title, meta: { entityId: a.id } })),
  ];

  const edges = [
    ...experiences.map((e) => ({ from: "user", to: `exp:${e.id}`, rel: "WORKED_AT" })),
    ...projects.map((p) =>
      p.experienceId
        ? { from: `exp:${p.experienceId}`, to: `proj:${p.id}`, rel: "PARTICIPATED_IN" }
        : { from: "user", to: `proj:${p.id}`, rel: "PARTICIPATED_IN" },
    ),
    ...projectSkills.map((ps) => ({ from: `proj:${ps.projectId}`, to: `skill:${ps.skillId}`, rel: "HAS_SKILL" })),
    // 证据边：经历/项目 → 技能（work_log 证据不入图，噪音大）
    ...evidences
      .filter((ev) => ev.sourceId && (ev.sourceType === "experience" || ev.sourceType === "project"))
      .map((ev) => ({
        from: `${ev.sourceType === "experience" ? "exp" : "proj"}:${ev.sourceId}`,
        to: `skill:${ev.skillId}`,
        rel: "EVIDENCED_BY",
      })),
    ...achievements.map((a) => ({
      from: a.projectId ? `proj:${a.projectId}` : a.experienceId ? `exp:${a.experienceId}` : "user",
      to: `ach:${a.id}`,
      rel: "HAS_ACHIEVEMENT",
    })),
  ];

  // 去重（同一对节点可能既有 HAS_SKILL 又有 EVIDENCED_BY）
  const seen = new Set<string>();
  const uniqueEdges = edges.filter((e) => {
    const key = `${e.from}->${e.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return ok({ nodes, edges: uniqueEdges });
});
