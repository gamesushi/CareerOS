import { prisma, AiRunKind, Prisma } from "@careeros/db";

// 每次 LLM 调用落 ai_runs（docs/design/04 §0：审计与成本追踪）

export async function startRun(params: {
  userId: string;
  kind: AiRunKind;
  inputRef: Record<string, unknown>;
  promptVersion: string;
}) {
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
  await prisma.aiRun.update({
    where: { id: runId },
    data: outcome.ok
      ? {
          status: "succeeded",
          model: outcome.model,
          tokensIn: outcome.tokensIn,
          tokensOut: outcome.tokensOut,
          latencyMs: outcome.latencyMs,
          finishedAt: new Date(),
        }
      : { status: "failed", error: outcome.error, latencyMs: outcome.latencyMs, finishedAt: new Date() },
  });
}
