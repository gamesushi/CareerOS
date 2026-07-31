import { z } from "zod";
import { prisma } from "@careeros/db";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";

// 列表：返回该用户全部申请（前端按 stage 分列）。
export const GET = handler(async () => {
  const { userId } = await requireUser();
  const data = await prisma.application.findMany({
    where: { userId },
    orderBy: [{ stage: "asc" }, { position: "asc" }, { createdAt: "desc" }],
    include: { resume: { select: { id: true, title: true } } },
  });
  return ok({ data });
});

const createInput = z.object({
  discoveredJobId: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  company: z.string().max(128).optional(),
  location: z.string().max(128).optional(),
  url: z.string().max(1000).optional(),
  salary: z.string().max(64).optional(),
  source: z.string().max(32).optional(),
});

// 创建：从发现岗位一键追踪（传 discoveredJobId），或手动录入（传 title 等）。
export const POST = handler(async (req) => {
  const { userId } = await requireUser();
  const input = await parseBody(req, createInput);

  let fields: {
    title: string; company?: string | null; location?: string | null; url?: string | null;
    salary?: string | null; source?: string | null; discoveredJobId?: string | null;
    jdId?: string | null; matchScore?: number | null;
  };

  if (input.discoveredJobId) {
    const dj = await prisma.discoveredJob.findFirst({ where: { id: input.discoveredJobId, userId } });
    if (!dj) throw new ApiError(404, "not_found", "发现岗位不存在");
    // 去重：同一发现岗位已在追踪则返回既有
    const existing = await prisma.application.findFirst({ where: { userId, discoveredJobId: dj.id } });
    if (existing) return ok({ data: existing, deduped: true });
    fields = {
      title: dj.title, company: dj.company, location: dj.location, url: dj.url,
      salary: dj.salary, source: dj.source, discoveredJobId: dj.id, jdId: dj.jdId, matchScore: dj.matchScore,
    };
  } else {
    if (!input.title) throw new ApiError(400, "validation_error", "手动录入需提供 title");
    fields = {
      title: input.title, company: input.company ?? null, location: input.location ?? null,
      url: input.url ?? null, salary: input.salary ?? null, source: input.source ?? "manual",
    };
  }

  const app = await prisma.application.create({
    data: {
      userId,
      ...fields,
      stage: "considering",
      events: { create: { kind: "created" } },
    },
  });
  return ok({ data: app });
});
