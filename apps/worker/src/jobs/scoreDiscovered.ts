import { prisma, Prisma } from "@careeros/db";
import { ensureEntityEmbeddings, embedTexts, topSimilar } from "../ai/embedding";

// 发现岗位自动打分（B）：岗位文本 ↔ 用户档案实体（经历/项目/技能）的 embedding 相似度。
// 不解析 JD、不调 LLM——每岗 1 次 embedding + 2 次向量查询。分数 0-100 + 命中理由。
//
// 相似度 band 为岗位级专用（区别于 jobMatch 的 JD 短句 band 0.65~0.8）：
// 经验标定（text-embedding-3-small，整段岗位文本 ↔ 实体文本）——强匹配≈0.32，无关≈0.03~0.10。
// 故取 ZERO=0.10（以下记 0）、FULL=0.32（以上满分），中间线性。
const JOB_SIM_ZERO = 0.1;
const JOB_SIM_FULL = 0.32;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lin = (sim: number) => clamp01((sim - JOB_SIM_ZERO) / (JOB_SIM_FULL - JOB_SIM_ZERO));
const round2 = (n: number) => Math.round(n * 100) / 100;

type Reason = { type: string; label: string; similarity: number };

async function labelReasons(raw: { type: string; id: string; similarity: number }[]): Promise<Reason[]> {
  const out: Reason[] = [];
  for (const r of raw) {
    let label = "";
    if (r.type === "skill") label = (await prisma.skill.findUnique({ where: { id: r.id }, select: { name: true } }))?.name ?? "";
    else if (r.type === "experience") {
      const e = await prisma.careerExperience.findUnique({ where: { id: r.id }, select: { company: true, title: true } });
      label = e ? `${e.company} · ${e.title}` : "";
    } else if (r.type === "project") label = (await prisma.project.findUnique({ where: { id: r.id }, select: { name: true } }))?.name ?? "";
    if (label) out.push({ type: r.type, label, similarity: round2(r.similarity) });
  }
  return out;
}

/** 为某用户的未评分（matchScore=null）、未下架发现岗位打分。返回评分数量。 */
export async function scoreDiscoveredJobs(userId: string, limit = 80): Promise<number> {
  const jobs = await prisma.discoveredJob.findMany({
    where: { userId, matchScore: null, takenDownAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, title: true, company: true, location: true, snippet: true },
  });
  if (jobs.length === 0) return 0;

  const added = await ensureEntityEmbeddings(userId);
  // 用户尚无任何可嵌入实体（空档案）时，全部记 0 分，避免每次重复计算。
  const hasEntities = added > 0 || (await prisma.embedding.count({ where: { userId } })) > 0;

  const texts = jobs.map((j) => [j.title, j.company, j.location, j.snippet].filter(Boolean).join("\n"));
  const vectors = hasEntities ? await embedTexts(texts) : [];

  for (let i = 0; i < jobs.length; i++) {
    let score = 0;
    let reasons: Reason[] = [];
    if (hasEntities) {
      const v = vectors[i];
      const [exp, skill] = await Promise.all([
        topSimilar(userId, v, ["experience", "project"]),
        topSimilar(userId, v, ["skill"]),
      ]);
      const expC = exp ? lin(exp.similarity) : 0;
      const skillC = skill ? lin(skill.similarity) : 0;
      score = round2(100 * (0.7 * expC + 0.3 * skillC));
      const raw: { type: string; id: string; similarity: number }[] = [];
      if (exp && expC > 0) raw.push({ type: exp.sourceType, id: exp.sourceId, similarity: exp.similarity });
      if (skill && skillC > 0) raw.push({ type: "skill", id: skill.sourceId, similarity: skill.similarity });
      reasons = await labelReasons(raw);
    }
    await prisma.discoveredJob.update({
      where: { id: jobs[i].id },
      data: { matchScore: score, matchReasons: reasons as unknown as Prisma.InputJsonValue },
    });
  }
  return jobs.length;
}

export async function handleScoreDiscoveredJob(userId: string): Promise<{ scanned: number; found: number }> {
  const n = await scoreDiscoveredJobs(userId);
  if (n > 0) console.log(`[score] scored ${n} discovered jobs for ${userId}`);
  return { scanned: n, found: 0 };
}
