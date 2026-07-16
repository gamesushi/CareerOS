import { prisma } from "@careeros/db";
import { applyImportInput, normalizeCompany, normalizeSkill } from "@careeros/shared";
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
    for (const exp of input.experiences) {
      const created = await tx.careerExperience.create({
        data: {
          userId,
          company: exp.company,
          companyNorm: normalizeCompany(exp.company),
          title: exp.title,
          employmentType: exp.employmentType,
          startDate: toDate(exp.startDate)!,
          endDate: toDate(exp.endDate),
          location: exp.location,
          description: exp.description,
          highlights: exp.highlights,
          lang: exp.lang,
          source: "import",
          importId: id,
        },
      });
      companyToExperienceId.set(normalizeCompany(exp.company), created.id);
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
