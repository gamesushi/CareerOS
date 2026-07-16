import { prisma } from "@careeros/db";
import { handler, ok, requireUser, ApiError } from "@/lib/api";
import { aiQueue } from "@/lib/queue";

// 触发匹配：创建占位 match 行（分数为 0、runId 空 = 计算中），worker 完成后回填。
// 历史 match 保留，用于"补充证据后分数提升"的对照（roadmap 留存实验）。

export const POST = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const jd = await prisma.jobDescription.findFirst({ where: { id, userId } });
  if (!jd) throw new ApiError(404, "not_found", "JD 不存在");
  if (jd.status !== "parsed") {
    throw new ApiError(409, "not_ready", `JD 状态为 ${jd.status}，解析完成后才能匹配`);
  }

  const match = await prisma.jobMatch.create({
    data: {
      jdId: id,
      userId,
      matchScore: 0,
      skillCoverage: 0,
      experienceCoverage: 0,
      industryCoverage: 0,
    },
  });
  await aiQueue.add("job_match", { matchId: match.id }, { jobId: `job-match-${match.id}` });
  return ok({ matchId: match.id }, 202);
});
