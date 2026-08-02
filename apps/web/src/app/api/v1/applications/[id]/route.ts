import { z } from "zod";
import { prisma, Prisma } from "@careeros/db";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";

const STAGES = ["considering", "applied", "screening", "interview", "offer", "rejected"] as const;

async function owned(userId: string, id: string) {
  const app = await prisma.application.findFirst({ where: { id, userId } });
  if (!app) throw new ApiError(404, "not_found", "申请不存在");
  return app;
}

export const GET = handler(async (_req, ctx) => {
  const { userId } = await requireUser();
  const { id } = await ctx.params;
  await owned(userId, id);
  const app = await prisma.application.findUnique({
    where: { id },
    include: {
      resume: { select: { id: true, title: true } },
      events: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!app) throw new ApiError(404, "not_found", "申请不存在");

  // 如果来自发现岗位，把完整 JD（snippet/raw）一起返回，供详情页展示
  let discoveredJob: { snippet: string | null; raw: Prisma.JsonValue | null; source: string } | null = null;
  if (app.discoveredJobId) {
    discoveredJob = await prisma.discoveredJob.findFirst({
      where: { id: app.discoveredJobId, userId },
      select: { snippet: true, raw: true, source: true },
    });
  }

  return ok({ data: { ...app, discoveredJob } });
});

const patchInput = z.object({
  stage: z.enum(STAGES).optional(),
  notes: z.string().max(5000).nullable().optional(),
  nextAction: z.string().max(200).nullable().optional(),
  nextActionAt: z.string().datetime().nullable().optional(),
  resumeId: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export const PATCH = handler(async (req, ctx) => {
  const { userId } = await requireUser();
  const { id } = await ctx.params;
  const before = await owned(userId, id);
  const input = await parseBody(req, patchInput);

  const stageChanged = input.stage !== undefined && input.stage !== before.stage;

  const app = await prisma.application.update({
    where: { id },
    data: {
      ...(input.stage !== undefined ? { stage: input.stage } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.nextAction !== undefined ? { nextAction: input.nextAction } : {}),
      ...(input.nextActionAt !== undefined ? { nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : null } : {}),
      ...(input.resumeId !== undefined ? { resumeId: input.resumeId } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
      ...(stageChanged
        ? { events: { create: { kind: "stage_change", fromStage: before.stage, toStage: input.stage } } }
        : {}),
    },
  });
  return ok({ data: app });
});

export const DELETE = handler(async (_req, ctx) => {
  const { userId } = await requireUser();
  const { id } = await ctx.params;
  await owned(userId, id);
  await prisma.application.delete({ where: { id } });
  return ok({ ok: true });
});
