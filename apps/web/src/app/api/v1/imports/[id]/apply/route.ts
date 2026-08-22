import { prisma } from "@careeros/db";
import { applyImportInput, normalizeCompany, normalizeSkill, companyRelated, dateOverlap, mergeFields, type ExpFields } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, toDate, ApiError } from "@/lib/api";

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
    // 1. 经历：company → id 映射，供项目挂靠
    const companyToExperienceId = new Map<string, string>();

    // 活库已入库经历，用于入库时再查一次、堵住「两份都在 review 时入库」的竞态
    const liveExps = await tx.careerExperience.findMany({
      where: { userId, deletedAt: null },
      select: {
        id: true, company: true, title: true, startDate: true, endDate: true,
        location: true, description: true, highlights: true,
      },
    });
    const liveMatches = (company: string, start: string, end: string | null | undefined) =>
      liveExps.filter(
        (r) =>
          companyRelated(company, r.company) &&
          dateOverlap(
            { startDate: start, endDate: end ?? null },
            {
              startDate: r.startDate ? r.startDate.toISOString().slice(0, 10) : null,
              endDate: r.endDate ? r.endDate.toISOString().slice(0, 10) : null,
            },
          ),
      );
    const isOwned = (recordId: string) => liveExps.some((r) => r.id === recordId);
    const rowToFields = (r: (typeof liveExps)[number]): ExpFields => ({
      company: r.company,
      title: r.title,
      startDate: r.startDate ? r.startDate.toISOString().slice(0, 10) : null,
      endDate: r.endDate ? r.endDate.toISOString().slice(0, 10) : null,
      location: (r.location as string | null) ?? null,
      description: (r.description as string | null) ?? null,
      highlights: Array.isArray(r.highlights) ? (r.highlights as string[]) : [],
    });

    for (const exp of input.experiences) {
      const fields: ExpFields = {
        company: exp.company,
        title: exp.title,
        startDate: exp.startDate,
        endDate: exp.endDate ?? null,
        location: exp.location ?? null,
        description: exp.description ?? null,
        highlights: exp.highlights,
      };
      const toData = (f: ExpFields) => ({
        company: f.company,
        companyNorm: normalizeCompany(f.company),
        title: f.title,
        employmentType: exp.employmentType,
        startDate: toDate(f.startDate)!,
        endDate: toDate(f.endDate),
        location: f.location,
        description: f.description,
        highlights: f.highlights,
        lang: exp.lang,
      });

      // 合并到已有经历（玩家在确认页选择「合并 / 用新版覆盖」）
      if (exp.mergeIntoId) {
        if (isOwned(exp.mergeIntoId)) {
          const updated = await tx.careerExperience.update({
            where: { id: exp.mergeIntoId },
            data: { ...toData(fields), source: "import", importId: id },
          });
          companyToExperienceId.set(normalizeCompany(fields.company), updated.id);
          continue;
        }
        // mergeIntoId 不属于当前用户 → 降级为新建，避免越权
      }

      // 玩家显式选择「两者都保留」
      if (exp.forceCreate) {
        const created = await tx.careerExperience.create({
          data: { userId, ...toData(fields), source: "import", importId: id },
        });
        companyToExperienceId.set(normalizeCompany(fields.company), created.id);
        continue;
      }

      // 竞态兜底：与活库已入库记录撞车（同公司 + 时间重叠）则合并更新，避免重复写入且不丢数据
      const hit = liveMatches(exp.company, exp.startDate, exp.endDate)[0];
      if (hit) {
        const merged = mergeFields(fields, rowToFields(hit));
        const updated = await tx.careerExperience.update({
          where: { id: hit.id },
          data: { ...toData(merged), source: "import", importId: id },
        });
        companyToExperienceId.set(normalizeCompany(merged.company), updated.id);
        continue;
      }

      const created = await tx.careerExperience.create({
        data: { userId, ...toData(fields), source: "import", importId: id },
      });
      companyToExperienceId.set(normalizeCompany(fields.company), created.id);
    }

    // 2. 项目：belongsToCompany 先匹配本次创建的经历，再匹配库内已有经历
    let projectCount = 0;
    for (const proj of input.projects) {
      let experienceId: string | null = null;
      if (proj.belongsToCompany) {
        const norm = normalizeCompany(proj.belongsToCompany);
        experienceId =
          companyToExperienceId.get(norm) ??
          (
            await tx.careerExperience.findFirst({
              where: { userId, companyNorm: norm, deletedAt: null },
              select: { id: true },
            })
          )?.id ??
          null;
      }
      await tx.project.create({
        data: {
          userId,
          experienceId,
          name: proj.name,
          role: proj.role,
          startDate: toDate(proj.startDate),
          endDate: toDate(proj.endDate),
          description: proj.description,
          outcome: proj.outcome,
          links: proj.links,
          techStack: proj.techStack,
          lang: proj.lang,
          source: "import",
          importId: id,
        },
      });
      projectCount++;
    }

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
        data: {
          userId,
          name: skill.name,
          nameNorm,
          category: skill.category,
          level: skill.level ?? 0,
          levelSource: "ai",
        },
      });
      skillCreated++;
    }

    // 4. 成果与教育
    for (const ach of input.achievements) {
      await tx.achievement.create({
        data: {
          userId,
          title: ach.title,
          metricValue: ach.metricValue,
          metricUnit: ach.metricUnit,
          metricText: ach.metricText,
          evidence: ach.evidence,
          occurredAt: toDate(ach.occurredAt),
        },
      });
    }
    for (const edu of input.educations) {
      await tx.education.create({
        data: {
          userId,
          school: edu.school,
          degree: edu.degree,
          major: edu.major,
          startDate: toDate(edu.startDate),
          endDate: toDate(edu.endDate),
          gpa: edu.gpa,
          description: edu.description,
        },
      });
    }

    const summary = {
      experiences: input.experiences.length,
      projects: projectCount,
      skills: skillCreated,
      skillsSkipped: skillSkipped,
      achievements: input.achievements.length,
      educations: input.educations.length,
    };

    // 5. 导入记录归档 + 画像置脏
    await tx.resumeImport.update({
      where: { id },
      data: { status: "applied", appliedDiff: summary },
    });
    await tx.careerProfile.upsert({
      where: { userId },
      update: { isStale: true },
      create: { userId, isStale: true },
    });

    return summary;
  });

  return ok({ applied: counts });
});
