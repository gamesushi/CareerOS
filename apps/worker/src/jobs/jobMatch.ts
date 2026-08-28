import { prisma, Prisma } from "@careeros/db";
import {
  normalizeSkill,
  jdParsed,
  MATCH_WEIGHTS,
  SKILL_SIM_THRESHOLD,
  EXP_SIM_FULL,
  EXP_SIM_ZERO,
} from "@careeros/shared";
import { ensureEntityEmbeddings, embedTexts, topSimilar, cosineSimilarity } from "../ai/embedding";
import { startRun, finishRun } from "../ai/audit";

// 三路打分（docs/design/01 §3.2）：
//   match = 0.5×技能 + 0.3×经历 + 0.2×行业；JD 缺某维度时该维度剔除、权重重归一化。
// 技能命中 = name_norm 精确/别名 → 向量 ≥0.85 兜底；得分乘 min(level/70, 1)。
// 经历 = JD 要求条目对 experiences+projects 向量 top-1：≥0.80 满分、0.65~0.80 线性、<0.65 零分。
// 匹配本身不调 LLM，快且免费（缺口建议属于展示层，后续增量）。

type Evidence = { jdItem: string; entityType: string; entityId: string; similarity: number };
type MissingSkill = { name: string; required: boolean; suggestion: string };

export async function handleJobMatchJob(matchId: string): Promise<void> {
  const match = await prisma.jobMatch.findUnique({ where: { id: matchId }, include: { jd: true } });
  if (!match) throw new Error(`匹配记录不存在: ${matchId}`);
  const { jd, userId } = match;

  const parsed = jdParsed.safeParse(jd.parsed);
  if (!parsed.success || jd.status !== "parsed") {
    throw new Error("JD 尚未解析完成，无法匹配");
  }
  const p = parsed.data;

  const run = await startRun({ userId, kind: "job_match", inputRef: { jdId: jd.id, matchId }, promptVersion: "match-v1" });
  // 先落 runId：前端通过 run.status 区分 计算中/成功/失败
  await prisma.jobMatch.update({ where: { id: matchId }, data: { runId: run.id } });
  const t0 = Date.now();

  try {
    await ensureEntityEmbeddings(userId);

    const matchedEvidence: Evidence[] = [];
    const missingSkills: MissingSkill[] = [];

    // ---- 技能覆盖 ----
    let skillCoverage: number | null = null;
    if (p.skills.length > 0) {
      const userSkills = await prisma.skill.findMany({ where: { userId } });
      const byNorm = new Map(userSkills.map((s) => [s.nameNorm, s]));
      // 用户级同义别名：JD 技能名(归一化) → 用户已有技能 id，作为精确命中后的第二优先级兜底。
      const userAliases = await prisma.skillAlias.findMany({ where: { userId } });
      const aliasMap = new Map(userAliases.map((a) => [a.aliasNorm, a.skillId]));
      const jdSkillVectors = await embedTexts(p.skills.map((s) => s.name));

      let gained = 0;
      let total = 0;
      for (const [i, jdSkill] of p.skills.entries()) {
        total += jdSkill.weight;
        let hit = byNorm.get(normalizeSkill(jdSkill.name)) ?? null;
        let similarity = 1;

        // 第二优先级：用户个人化同义别名兜底（如 JD"用户研究方法"→用户技能"用户研究"）
        if (!hit) {
          const aliasedSkillId = aliasMap.get(normalizeSkill(jdSkill.name));
          if (aliasedSkillId) {
            hit = userSkills.find((s) => s.id === aliasedSkillId) ?? null;
            similarity = 1;
          }
        }

        if (!hit) {
          const top = await topSimilar(userId, jdSkillVectors[i], ["skill"]);
          if (top && top.similarity >= SKILL_SIM_THRESHOLD) {
            hit = userSkills.find((s) => s.id === top.sourceId) ?? null;
            similarity = top.similarity;
          }
        }

        if (hit) {
          const levelFactor = Math.min((hit.level || 40) / 70, 1); // level 未评估(0)按保守 40 计
          gained += jdSkill.weight * levelFactor;
          matchedEvidence.push({ jdItem: `技能：${jdSkill.name}`, entityType: "skill", entityId: hit.id, similarity });
        } else {
          missingSkills.push({
            name: jdSkill.name,
            required: jdSkill.required,
            suggestion: jdSkill.required
              ? "硬性要求未命中：如有相关经验，请在技能中心补录并挂证据"
              : "加分项：可在工作日志中积累相关记录",
          });
        }
      }
      skillCoverage = (gained / total) * 100;
    }

    // ---- 经历覆盖 ----
    let experienceCoverage: number | null = null;
    if (p.experience.length > 0) {
      const reqVectors = await embedTexts(p.experience.map((e) => e.desc));
      let sum = 0;
      for (const [i, req] of p.experience.entries()) {
        const top = await topSimilar(userId, reqVectors[i], ["experience", "project"]);
        let score = 0;
        if (top) {
          if (top.similarity >= EXP_SIM_FULL) score = 1;
          else if (top.similarity > EXP_SIM_ZERO) {
            score = (top.similarity - EXP_SIM_ZERO) / (EXP_SIM_FULL - EXP_SIM_ZERO);
          }
          if (score > 0) {
            matchedEvidence.push({
              jdItem: `要求：${req.desc.slice(0, 60)}`,
              entityType: top.sourceType,
              entityId: top.sourceId,
              similarity: top.similarity,
            });
          }
        }
        sum += score;
      }
      experienceCoverage = (sum / p.experience.length) * 100;
    }

    // ---- 行业覆盖（跨语言：用向量相似度，而非精确字符串相等，避免英文 JD ↔ 中文行业标签零命中） ----
    let industryCoverage: number | null = null;
    if (p.industry.length > 0) {
      const profile = await prisma.careerProfile.findUnique({ where: { userId } });
      const userTags = (profile?.industryTags ?? []).filter(Boolean) as string[];
      if (userTags.length > 0) {
        const jdVectors = await embedTexts(p.industry);
        const userVectors = await embedTexts(userTags);
        const THRESH = 0.72;
        let hits = 0;
        for (const jv of jdVectors) {
          let best = 0;
          for (const uv of userVectors) best = Math.max(best, cosineSimilarity(jv, uv));
          if (best >= THRESH) hits++;
        }
        industryCoverage = (hits / p.industry.length) * 100;
      } else {
        industryCoverage = 0;
      }
    }

    // ---- 加权汇总（空维度剔除重归一化） ----
    const parts: { weight: number; value: number }[] = [];
    if (skillCoverage != null) parts.push({ weight: MATCH_WEIGHTS.skill, value: skillCoverage });
    if (experienceCoverage != null) parts.push({ weight: MATCH_WEIGHTS.experience, value: experienceCoverage });
    if (industryCoverage != null) parts.push({ weight: MATCH_WEIGHTS.industry, value: industryCoverage });
    const totalWeight = parts.reduce((s, x) => s + x.weight, 0) || 1;
    const matchScore = parts.reduce((s, x) => s + x.value * (x.weight / totalWeight), 0);

    // 证据补充可读标签
    const labeled = await labelEvidence(matchedEvidence);

    await prisma.jobMatch.update({
      where: { id: matchId },
      data: {
        matchScore: round2(matchScore),
        skillCoverage: round2(skillCoverage ?? 0),
        experienceCoverage: round2(experienceCoverage ?? 0),
        industryCoverage: round2(industryCoverage ?? 0),
        missingSkills: missingSkills as unknown as Prisma.InputJsonValue,
        matchedEvidence: labeled as unknown as Prisma.InputJsonValue,
        runId: run.id,
      },
    });
    await finishRun(run.id, { ok: true, model: "local", tokensIn: 0, tokensOut: 0, latencyMs: Date.now() - t0 });
  } catch (e) {
    await finishRun(run.id, { ok: false, error: String(e), latencyMs: Date.now() - t0 });
    throw e;
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

async function labelEvidence(evidence: Evidence[]) {
  const byType: Record<string, string[]> = {};
  for (const e of evidence) (byType[e.entityType] ??= []).push(e.entityId);

  const labels = new Map<string, string>();
  if (byType.skill?.length) {
    for (const s of await prisma.skill.findMany({ where: { id: { in: byType.skill } } })) {
      labels.set(s.id, s.name);
    }
  }
  if (byType.experience?.length) {
    for (const e of await prisma.careerExperience.findMany({ where: { id: { in: byType.experience } } })) {
      labels.set(e.id, `${e.company} · ${e.title}`);
    }
  }
  if (byType.project?.length) {
    for (const proj of await prisma.project.findMany({ where: { id: { in: byType.project } } })) {
      labels.set(proj.id, proj.name);
    }
  }
  return evidence.map((e) => ({ ...e, entityLabel: labels.get(e.entityId) ?? "", similarity: round2(e.similarity) }));
}
