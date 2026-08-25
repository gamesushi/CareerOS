import { prisma } from "@careeros/db";
import {
  applyImportInput,
  normalizeCompany,
  normalizeSkill,
  sectionCandidate,
  mergeItems,
  toNewItems,
  toExistingItems,
  type SectionKind,
  type MergeItem,
} from "@careeros/shared";
import { handler, ok, parseBody, requireUser, toDate, ApiError } from "@/lib/api";

// 各分栏对应的 Prisma 表名
const SECTION_TABLE: Record<SectionKind, "careerExperience" | "project" | "achievement" | "education" | "honor"> = {
  work: "careerExperience",
  project: "project",
  achievement: "achievement",
  education: "education",
  honor: "honor",
};
// 是否带软删除字段（用于 where 过滤）
const HAS_SOFT_DELETE: Record<SectionKind, boolean> = {
  work: true,
  project: true,
  achievement: false,
  education: false,
  honor: false,
};

// 确认页提交：把用户勾选/修正后的实体集事务写入职业库（ADR-005：解析结果必须人工确认后入库）
export const POST = handler(async (req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;

  const imp = await prisma.resumeImport.findFirst({ where: { id, userId } });
  if (!imp) throw new ApiError(404, "not_found", "导入记录不存在");
  if (imp.status !== "review") {
    throw new ApiError(409, "invalid_status", `当前状态为 ${imp.status}，只有 review 状态可入库`);
  }

  const input = await parseBody(req, applyImportInput);

  const counts = await prisma.$transaction(async (tx) => {
    const companyToExperienceId = new Map<string, string>();

    const whereUserId = (kind: SectionKind) => ({
      userId,
      ...(HAS_SOFT_DELETE[kind] ? { deletedAt: null } : {}),
    });

    // 预载各分栏已有 id 集合，用于 mergeIntoId 越权校验
    const ownedIds: Record<SectionKind, Set<string>> = {
      work: new Set((await tx.careerExperience.findMany({ where: whereUserId("work"), select: { id: true } })).map((r) => r.id)),
      project: new Set((await tx.project.findMany({ where: whereUserId("project"), select: { id: true } })).map((r) => r.id)),
      achievement: new Set((await tx.achievement.findMany({ where: whereUserId("achievement"), select: { id: true } })).map((r) => r.id)),
      education: new Set((await tx.education.findMany({ where: whereUserId("education"), select: { id: true } })).map((r) => r.id)),
      honor: new Set((await tx.honor.findMany({ where: whereUserId("honor"), select: { id: true } })).map((r) => r.id)),
    };

    const resolveExperienceId = async (belongsToCompany?: string | null): Promise<string | null> => {
      if (!belongsToCompany) return null;
      const norm = normalizeCompany(belongsToCompany);
      return (
        companyToExperienceId.get(norm) ??
        (await tx.careerExperience.findFirst({ where: { userId, companyNorm: norm, deletedAt: null }, select: { id: true } }))?.id ??
        null
      );
    };

    // 把 MergeItem.raw 映射为 Prisma 写库数据
    const toData = (kind: SectionKind, item: MergeItem, extra: Record<string, unknown> = {}): Record<string, unknown> => {
      const raw = item.raw as Record<string, unknown>;
      switch (kind) {
        case "work":
          return {
            company: raw.company,
            companyNorm: normalizeCompany(String(raw.company)),
            title: raw.title,
            employmentType: extra.employmentType ?? null,
            startDate: toDate(String(raw.startDate))!,
            endDate: toDate(raw.endDate as string),
            location: raw.location ?? null,
            description: raw.description ?? null,
            highlights: raw.highlights ?? [],
            lang: extra.lang ?? "zh",
          };
        case "project":
          return {
            name: raw.name,
            role: raw.role ?? null,
            startDate: toDate(raw.startDate as string),
            endDate: toDate(raw.endDate as string),
            description: raw.description ?? null,
            outcome: raw.outcome ?? null,
            links: raw.links ?? [],
            techStack: raw.techStack ?? [],
            lang: extra.lang ?? "zh",
            experienceId: (extra.experienceId as string) ?? null,
          };
        case "achievement":
          return {
            title: raw.title,
            metricValue: raw.metricValue ?? null,
            metricUnit: raw.metricUnit ?? null,
            metricText: raw.metricText ?? null,
            evidence: raw.evidence ?? null,
            occurredAt: toDate(raw.occurredAt as string),
          };
        case "education":
          return {
            school: raw.school,
            degree: raw.degree ?? null,
            major: raw.major ?? null,
            faculty: raw.faculty ?? null,
            startDate: toDate(raw.startDate as string),
            endDate: toDate(raw.endDate as string),
            gpa: raw.gpa ?? null,
            description: raw.description ?? null,
          };
        case "honor":
          return {
            title: raw.title,
            issuer: raw.issuer ?? null,
            date: toDate(raw.date as string),
            description: raw.description ?? null,
          };
      }
    };

    // 竞态合并：与活库已入库记录撞车（同身份+重叠）则合并更新，避免重复写入且不丢数据
    const matchLive = async (kind: SectionKind, newItem: MergeItem): Promise<{ id: string } | null> => {
      const full = (await (tx as Record<string, any>)[SECTION_TABLE[kind]].findMany({ where: whereUserId(kind) })) as Record<string, unknown>[];
      const existingItems = toExistingItems(kind, full);
      for (let i = 0; i < existingItems.length; i++) {
        if (sectionCandidate(kind, newItem, existingItems[i])) return { id: String(full[i].id) };
      }
      return null;
    };

    const writeKind = async (
      kind: SectionKind,
      items: Record<string, any>[],
      extraFor?: (item: any) => Record<string, unknown>,
    ): Promise<void> => {
      for (const item of items) {
        const newItem = toNewItems(kind, [item])[0];
        const extra = extraFor ? extraFor(item) : {};
        // 合并到已有记录（玩家在确认页选择「合并 / 用新版覆盖」）
        if (item.mergeIntoId && ownedIds[kind].has(item.mergeIntoId)) {
          await (tx as Record<string, any>)[SECTION_TABLE[kind]].update({
            where: { id: item.mergeIntoId },
            data: toData(kind, newItem, extra),
          });
          if (kind === "work") companyToExperienceId.set(normalizeCompany(String(newItem.raw.company)), item.mergeIntoId);
          continue;
        }
        // 玩家显式选择「两者都保留」
        if (item.forceCreate) {
          const created = await (tx as Record<string, any>)[SECTION_TABLE[kind]].create({
            data: { userId, ...toData(kind, newItem, extra), source: "import", importId: id },
          });
          if (kind === "work") companyToExperienceId.set(normalizeCompany(String(newItem.raw.company)), created.id);
          continue;
        }
        // 竞态兜底：与活库已入库记录撞车（同身份+重叠）则合并更新
        const hit = await matchLive(kind, newItem);
        if (hit) {
          const full = await (tx as Record<string, any>)[SECTION_TABLE[kind]].findUnique({ where: { id: hit.id } });
          const merged = mergeItems(kind, newItem, toExistingItems(kind, [full])[0]);
          await (tx as Record<string, any>)[SECTION_TABLE[kind]].update({
            where: { id: hit.id },
            data: toData(kind, merged, extra),
          });
          if (kind === "work") companyToExperienceId.set(normalizeCompany(String(merged.raw.company)), hit.id);
          continue;
        }
        const created = await (tx as Record<string, any>)[SECTION_TABLE[kind]].create({
          data: { userId, ...toData(kind, newItem, extra), source: "import", importId: id },
        });
        if (kind === "work") companyToExperienceId.set(normalizeCompany(String(newItem.raw.company)), created.id);
      }
    };

    // 1. 工作经历（先写，建立 company→experienceId 映射供项目挂靠）
    await writeKind("work", input.experiences, (e) => ({ employmentType: e.employmentType, lang: e.lang }));

    // 2. 项目：belongsToCompany 先匹配本次创建的经历，再匹配库内已有经历
    const projectsWithExp = await Promise.all(
      input.projects.map(async (p) => ({ ...p, experienceId: await resolveExperienceId(p.belongsToCompany) })),
    );
    await writeKind("project", projectsWithExp, (p) => ({ experienceId: p.experienceId, lang: p.lang }));

    // 3. 技能：已存在（nameNorm 撞车）则跳过，不覆盖用户手工数据
    let skillCreated = 0;
    let skillSkipped = 0;
    for (const skill of input.skills) {
      const nameNorm = normalizeSkill(skill.name);
      const existing = await tx.skill.findUnique({
        where: { userId_nameNorm: { userId, nameNorm } },
      });
      if (existing) {
        skillSkipped++;
        continue;
      }
      await tx.skill.create({
        data: { userId, name: skill.name, nameNorm, category: skill.category, level: skill.level ?? 0, levelSource: "ai" },
      });
      skillCreated++;
    }

    // 4. 成果 / 教育 / 荣誉（均支持 AI 判重合并）
    await writeKind("achievement", input.achievements);
    await writeKind("education", input.educations);
    await writeKind("honor", input.honors);

    const summary = {
      experiences: input.experiences.length,
      projects: input.projects.length,
      skills: skillCreated,
      skillsSkipped: skillSkipped,
      achievements: input.achievements.length,
      educations: input.educations.length,
      honors: input.honors.length,
    };

    // 5. 导入记录归档 + 画像置脏
    await tx.resumeImport.update({ where: { id }, data: { status: "applied", appliedDiff: summary } });
    await tx.careerProfile.upsert({
      where: { userId },
      update: { isStale: true },
      create: { userId, isStale: true },
    });

    return summary;
  });

  return ok({ applied: counts });
});
