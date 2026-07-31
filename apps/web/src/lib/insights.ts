import { prisma } from "@careeros/db";

// 流水线顺序（rejected 为终态，不在管线序内，其"最远到达"取被拒前的最高阶段）
const PIPELINE = ["considering", "applied", "screening", "interview", "offer"] as const;
const idx = (s: string | null | undefined) => PIPELINE.indexOf((s ?? "") as (typeof PIPELINE)[number]);

export type Insights = {
  total: number;
  rejected: number;
  funnel: { stage: string; count: number }[]; // 「曾到达 ≥ 该阶段」的申请数
  currentStage: Record<string, number>;
  scoreBands: { band: "strong" | "moderate" | "weak" | "unscored"; total: number; reachedInterview: number; interviewRate: number }[];
  byResume: { title: string; total: number; reachedInterview: number; interviewRate: number }[];
};

export async function getInsights(userId: string): Promise<Insights> {
  const apps = await prisma.application.findMany({
    where: { userId },
    select: {
      stage: true,
      matchScore: true,
      resumeId: true,
      resume: { select: { title: true } },
      events: { where: { kind: "stage_change" }, select: { toStage: true } },
    },
  });

  const total = apps.length;
  const funnelCount: Record<string, number> = { considering: 0, applied: 0, screening: 0, interview: 0, offer: 0 };
  const currentStage: Record<string, number> = {};
  const bandAgg: Record<string, { total: number; reachedInterview: number }> = {
    strong: { total: 0, reachedInterview: 0 },
    moderate: { total: 0, reachedInterview: 0 },
    weak: { total: 0, reachedInterview: 0 },
    unscored: { total: 0, reachedInterview: 0 },
  };
  let rejected = 0;
  const resumeAgg = new Map<string, { title: string; total: number; reachedInterview: number }>();

  for (const a of apps) {
    currentStage[a.stage] = (currentStage[a.stage] ?? 0) + 1;
    if (a.stage === "rejected") rejected++;

    // 曾到达的最高管线阶段：考虑当前阶段 + 所有 stage_change 的 toStage
    const reachedIdxs = [idx(a.stage), ...a.events.map((e) => idx(e.toStage))].filter((i) => i >= 0);
    const maxI = reachedIdxs.length ? Math.max(...reachedIdxs) : 0;
    const reachedInterview = maxI >= idx("interview");

    for (let i = 0; i <= maxI; i++) funnelCount[PIPELINE[i]]++;

    const band = a.matchScore == null ? "unscored" : a.matchScore >= 60 ? "strong" : a.matchScore >= 30 ? "moderate" : "weak";
    bandAgg[band].total++;
    if (reachedInterview) bandAgg[band].reachedInterview++;

    // 简历 A/B：仅统计已关联简历的申请
    if (a.resumeId && a.resume) {
      const cur = resumeAgg.get(a.resumeId) ?? { title: a.resume.title, total: 0, reachedInterview: 0 };
      cur.total++;
      if (reachedInterview) cur.reachedInterview++;
      resumeAgg.set(a.resumeId, cur);
    }
  }

  return {
    total,
    rejected,
    funnel: PIPELINE.map((s) => ({ stage: s, count: funnelCount[s] })),
    currentStage,
    scoreBands: (["strong", "moderate", "weak", "unscored"] as const).map((band) => ({
      band,
      total: bandAgg[band].total,
      reachedInterview: bandAgg[band].reachedInterview,
      interviewRate: bandAgg[band].total ? bandAgg[band].reachedInterview / bandAgg[band].total : 0,
    })),
    byResume: [...resumeAgg.values()]
      .map((r) => ({ ...r, interviewRate: r.total ? r.reachedInterview / r.total : 0 }))
      .sort((a, b) => b.total - a.total),
  };
}
