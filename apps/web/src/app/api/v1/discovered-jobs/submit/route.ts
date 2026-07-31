// 用户录入岗位入库：手动表单与「链接导入确认」共用。
// 岗位挂在用户专属的「我的收录」watch 下，进入 discovered_jobs 总库
// （排行榜 / 公开统计 / feed 均自然计入）。

import { z } from "zod";
import { prisma, type Prisma } from "@careeros/db";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";
import { ensureSubmitWatch, findDuplicateByUrl, normalizeJobUrl, urlExternalId } from "@/lib/user-jobs";

const submitInput = z.object({
  title: z.string().trim().min(2, "职位名称至少 2 个字符").max(200),
  url: z.string().trim().url("请填写合法的岗位链接").max(2000),
  company: z.string().trim().max(128).optional(),
  location: z.string().trim().max(128).optional(),
  salary: z.string().trim().max(64).optional(),
  snippet: z.string().trim().max(5000).optional(),
  publishedAt: z.string().datetime({ offset: true }).optional(),
  via: z.enum(["manual", "import"]).default("manual"),
  /** 为 true 时跳过 URL 查重（用户确认「仍要收录」）。 */
  force: z.boolean().default(false),
});

export const POST = handler(async (req) => {
  const { userId } = await requireUser();
  const input = await parseBody(req, submitInput);

  if (!/^https?:\/\//i.test(input.url)) {
    throw new ApiError(400, "invalid_url", "岗位链接必须以 http(s):// 开头");
  }

  if (!input.force) {
    const dup = await findDuplicateByUrl(input.url);
    if (dup) {
      throw new ApiError(
        409,
        "duplicate_url",
        `该链接已在库中：${[dup.company, dup.title].filter(Boolean).join(" · ")}（来源 ${dup.source}）`,
      );
    }
  }

  const watch = await ensureSubmitWatch(userId);
  const source = input.via === "import" ? "import" : "user";
  const row: Prisma.DiscoveredJobCreateInput = {
    watch: { connect: { id: watch.id } },
    user: { connect: { id: userId } },
    source,
    reviewStatus: "pending", // 用户录入先进审核队列，过审后才进公共统计/排行榜
    externalId: urlExternalId(input.url),
    title: input.title.slice(0, 200),
    url: normalizeJobUrl(input.url),
    categories: [],
    roles: [],
    regions: [],
    languages: [],
    experience: [],
  };
  if (input.company) row.company = input.company.slice(0, 128);
  if (input.location) row.location = input.location.slice(0, 128);
  if (input.salary) row.salary = input.salary.slice(0, 64);
  if (input.snippet) row.snippet = input.snippet;
  if (input.publishedAt) {
    const d = new Date(input.publishedAt);
    if (!Number.isNaN(d.getTime())) row.publishedAt = d; // 拒绝 Invalid Date（worker 同款教训）
  }

  try {
    const created = await prisma.discoveredJob.create({ data: row });
    return ok({ id: created.id, source: created.source, reviewStatus: created.reviewStatus }, 201);
  } catch (e) {
    // 唯一键 (watchId, source, externalId) 冲突 → 该用户已收录过同一链接
    if ((e as { code?: string }).code === "P2002") {
      throw new ApiError(409, "already_submitted", "你已收录过这个岗位链接");
    }
    throw e;
  }
});
