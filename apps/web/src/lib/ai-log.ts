import { prisma, type AiRunKind, type AiRunStatus } from "@careeros/db";

// Web 侧同步 AI 调用的记账（写进 AiRun，供 admin 成本看板可见）。
// 先落一条 running，调用结束再更新为 succeeded/failed —— 这样限流能计入在途请求。

export async function startAiRun(userId: string, kind: AiRunKind): Promise<string> {
  const r = await prisma.aiRun.create({ data: { userId, kind, status: "running" } });
  return r.id;
}

export async function finishAiRun(
  id: string,
  p: { status: AiRunStatus; model?: string | null; tokensIn?: number; tokensOut?: number; latencyMs?: number; error?: string | null },
): Promise<void> {
  await prisma.aiRun
    .update({
      where: { id },
      data: {
        status: p.status,
        model: p.model ?? null,
        tokensIn: p.tokensIn ?? null,
        tokensOut: p.tokensOut ?? null,
        latencyMs: p.latencyMs ?? null,
        error: p.error ?? null,
        finishedAt: new Date(),
      },
    })
    .catch(() => {
      /* 记账失败不影响主流程 */
    });
}

/** 基于 AiRun 的用户级限流：近 windowSec 秒内该 kind 的调用数达到 max 即拦截（含在途 running）。 */
export async function aiRateLimited(userId: string, kind: AiRunKind, max: number, windowSec: number): Promise<boolean> {
  const since = new Date(Date.now() - windowSec * 1000);
  const n = await prisma.aiRun.count({ where: { userId, kind, createdAt: { gte: since } } });
  return n >= max;
}
