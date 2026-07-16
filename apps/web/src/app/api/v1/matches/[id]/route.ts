import { prisma } from "@careeros/db";
import { handler, ok, requireUser, ApiError } from "@/lib/api";

// runId 为空 = 排队/刚开始；runId 存在 → 查 ai_runs.status 得 computing/succeeded/failed

export const GET = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const match = await prisma.jobMatch.findFirst({
    where: { id, userId },
    include: { jd: { select: { id: true, company: true, title: true } } },
  });
  if (!match) throw new ApiError(404, "not_found", "匹配记录不存在");

  let state: "computing" | "succeeded" | "failed" = "computing";
  let error: string | null = null;
  if (match.runId) {
    const run = await prisma.aiRun.findUnique({ where: { id: match.runId } });
    if (run?.status === "succeeded") state = "succeeded";
    else if (run?.status === "failed") {
      state = "failed";
      error = run.error;
    }
  }
  return ok({ ...match, state, error });
});
