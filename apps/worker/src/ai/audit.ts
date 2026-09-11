import { prisma, AiRunKind, Prisma } from "@careeros/db";
import { assertAiQuota, deductTokens, costForModel } from "../billing/tokens";

// 每次 LLM 调用落 ai_runs（docs/design/04 §0：审计与成本追踪）

export async function startRun(params: {
  userId: string;
  kind: AiRunKind;
  inputRef: Record<string, unknown>;
  promptVersion: string;
}) {
  // 预检 token 额度（余额 + 每日上限），不足直接抛 TokenQuotaError（402 语义）。
  // 放在建行之前，避免产生 orphan running 记录。
  await assertAiQuota(params.userId, params.kind);
  return prisma.aiRun.create({
    data: {
      userId: params.userId,
      kind: params.kind,
      status: "running",
      inputRef: params.inputRef as Prisma.InputJsonValue,
      promptVersion: params.promptVersion,
    },
  });
}

export async function finishRun(
  runId: string,
  outcome:
    | { ok: true; model: string; tokensIn: number; tokensOut: number; latencyMs: number }
    | { ok: false; error: string; latencyMs: number },
) {
  const run = await prisma.aiRun.findUnique({ where: { id: runId }, select: { userId: true } });
  const data: Prisma.AiRunUpdateInput = outcome.ok
    ? {
        status: "succeeded",
        model: outcome.model,
        tokensIn: outcome.tokensIn,
        tokensOut: outcome.tokensOut,
        latencyMs: outcome.latencyMs,
        finishedAt: new Date(),
      }
    : { status: "failed", error: outcome.error, latencyMs: outcome.latencyMs, finishedAt: new Date() };

  // 成功调用按 tokensIn+tokensOut 扣费，并写真实 ¥ 成本（costUsd）/ 内部 token（costTokens）
  if (outcome.ok && run?.userId) {
    const amount = outcome.tokensIn + outcome.tokensOut;
    if (amount > 0) {
      data.costTokens = amount;
      data.costUsd = new Prisma.Decimal(await costForModel(outcome.model, outcome.tokensIn, outcome.tokensOut));
      await deductTokens(run.userId, amount, "ai_run", runId).catch((e) => console.warn("[billing] deduct failed", e));
    }
  }

  await prisma.aiRun.update({ where: { id: runId }, data });
}
