import { prisma, Prisma } from "@careeros/db";
import { SOURCES } from "../sources";
import { politeDelay, type SourceJob } from "../sources/types";
import { deriveCategories } from "../sources/lib/category";
import { deriveJobTags, matchesTags } from "../sources/lib/taxonomy";
import { scoreDiscoveredJobs } from "./scoreDiscovered";

// 岗位监测轮询：调度器每 5 分钟触发一次扫描，处理"到期"的监测任务
// （enabled 且 距上次运行 ≥ intervalMinutes）。手动触发时直接传 watchId。
// 新岗位按 (watch, source, externalId) 去重入库，状态 new，等待用户处理。

async function withRetry<T>(fn: () => Promise<T>, opts: { retries: number; delayMs: number; label: string }): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= opts.retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < opts.retries) {
        console.log(`[watch] retry ${opts.label} (${i + 1}/${opts.retries}) after ${opts.delayMs}ms: ${e instanceof Error ? e.message : String(e)}`);
        await new Promise((r) => setTimeout(r, opts.delayMs));
      }
    }
  }
  throw lastErr;
}

// 硬门槛（确定性规则）：命中排除词、或 publishedAt 超过 maxAgeDays 即丢弃。无发布时间的岗位不做陈旧过滤。
function passesHardGates(
  job: { title: string; snippet?: string | null; publishedAt?: Date | null },
  watch: { excludeKeywords: string[]; maxAgeDays: number | null },
): boolean {
  const text = `${job.title ?? ""} ${job.snippet ?? ""}`.toLowerCase();
  if (watch.excludeKeywords?.some((k) => k && text.includes(k.toLowerCase()))) return false;
  if (watch.maxAgeDays && job.publishedAt instanceof Date && !Number.isNaN(job.publishedAt.getTime())) {
    if ((Date.now() - job.publishedAt.getTime()) / 86_400_000 > watch.maxAgeDays) return false;
  }
  return true;
}

// 由过滤后的岗位构造入库行（字段同原 createMany 逻辑）
function buildJobRow(
  watch: { id: string; userId: string },
  sourceId: string,
  j: any,
  categories: any,
  tags: any,
): Prisma.DiscoveredJobCreateManyInput {
  const cleanArr = (x: unknown): Prisma.InputJsonValue[] =>
    Array.isArray(x) ? (x.filter((v) => v != null) as Prisma.InputJsonValue[]) : [];
  const normCategories = cleanArr(categories);
  const normRoles = cleanArr(tags.roles);
  const normRegions = cleanArr(tags.regions);
  const normLanguages = cleanArr(tags.languages);
  const normExperience = cleanArr(tags.experience);
  const row: Prisma.DiscoveredJobCreateManyInput = {
    watchId: watch.id,
    userId: watch.userId,
    source: sourceId,
    externalId: j.externalId,
    title: j.title.slice(0, 200),
    url: j.url,
    categories: normCategories as Prisma.InputJsonValue,
    roles: normRoles as unknown as Prisma.InputJsonValue,
    regions: normRegions as unknown as Prisma.InputJsonValue,
    languages: normLanguages as unknown as Prisma.InputJsonValue,
    experience: normExperience as unknown as Prisma.InputJsonValue,
  };
  if (j.company) row.company = j.company.slice(0, 128);
  if (j.location) row.location = j.location.slice(0, 128);
  if (j.salary) row.salary = j.salary.slice(0, 64);
  if (j.snippet) row.snippet = j.snippet;
  if (j.publishedAt instanceof Date && !Number.isNaN(j.publishedAt.getTime())) {
    row.publishedAt = j.publishedAt;
  }
  if (j.raw != null) row.raw = j.raw as Prisma.InputJsonValue;
  return row;
}

// create 行 → update 行：去掉稳定键，undefined 字段跳过（保留旧值），并清除停招标记（重新出现=复活）
function rowToUpdate(r: Prisma.DiscoveredJobCreateManyInput): Prisma.DiscoveredJobUpdateInput {
  const { watchId: _w, userId: _u, source: _s, externalId: _e, ...rest } = r as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) data[k] = v;
  }
  data.closedAt = null;
  return data as unknown as Prisma.DiscoveredJobUpdateInput;
}

export async function handleWatchPollJob(
  watchId?: string,
): Promise<{ scanned: number; found: number; created: number; updated: number; closed: number; deleted: number }> {
  const now = new Date();
  const watches = watchId
    ? await prisma.jobWatch.findMany({ where: { id: watchId } })
    : await prisma.jobWatch.findMany({ where: { enabled: true } });

  const CLOSE_GRACE_DAYS = 14; // 停招多少天后自动删除
  let scanned = 0;
  let found = 0;
  let created = 0;
  let updated = 0;
  let closed = 0;
  let deleted = 0;
  const usersWithNewJobs = new Set<string>();

  // 跨 watch 的整板抓取缓存：实现 fetchAll 的来源（Greenhouse/Ashby/Lever/Playwright 整板型）
  // 在一次轮询内按 sourceId 只抓一次，各关键词复用同一份结果，避免同一板块被多关键词重复抓取。
  const boardCache = new Map<string, SourceJob[]>();

  for (const watch of watches) {
    // 定时扫描时只处理到期任务；手动触发（watchId 指定）不受间隔限制
    if (!watchId && watch.lastRunAt) {
      const dueAt = watch.lastRunAt.getTime() + watch.intervalMinutes * 60_000;
      if (dueAt > now.getTime()) continue;
    }
    scanned++;

    const errors: string[] = [];
    // 本轮各来源实际抓到的 externalId，用于差集判定停招
    const seenBySource = new Map<string, Set<string>>();
    for (const sourceId of watch.sources) {
      const source = SOURCES[sourceId];
      if (!source) {
        errors.push(`未知来源 ${sourceId}`);
        continue;
      }
      for (const keyword of watch.keywords) {
        let jobs: SourceJob[];
        let didFetch = false;
        try {
          if (source.fetchAll) {
            // 整板抓取型：一次轮询内按来源缓存，避免 (来源 × 关键词) 组合重复抓同一板块
            if (!boardCache.has(sourceId)) {
              boardCache.set(
                sourceId,
                await withRetry(() => source.fetchAll!(), {
                  retries: 2,
                  delayMs: 1000,
                  label: `${sourceId}/fetchAll`,
                }),
              );
              didFetch = true;
            }
            jobs = boardCache.get(sourceId)!;
          } else {
            // 真按关键词查询的来源（如腾讯/字节/猎聘）：逐关键词调用
            jobs = await withRetry(
              () => source.search(keyword),
              { retries: 2, delayMs: 1000, label: `${sourceId}/${keyword}` },
            );
            didFetch = true;
          }
          // 通用兜底：部分适配器（如米哈游 Playwright DOM 抓取）无法按 keyword 过滤，
          // 返回全量岗位。worker 层必须保证岗位 title/snippet 命中监测关键词才入库。
          const kw = keyword.trim().toLowerCase();
          const keywordMatched = kw
            ? jobs.filter((j) =>
                `${j.title ?? ""} ${j.snippet ?? ""}`.toLowerCase().includes(kw),
              )
            : jobs;
          let filtered =
            watch.locations.length === 0
              ? keywordMatched
              : keywordMatched.filter(
                  (j) => !j.location || watch.locations.some((loc) => j.location!.includes(loc)),
                );
          // 品类匹配：适配器可能未提供 categories，用文本+来源亲和兜底分类
          const wantCategories = new Set(watch.matchCategories ?? []);
          const withCategories = filtered.map((j) => ({
            job: j,
            categories:
              j.categories && j.categories.length > 0
                ? j.categories
                : deriveCategories(`${j.title} ${j.snippet ?? ""}`, source.category),
          }));
          const categoryMatched =
            wantCategories.size > 0
              ? withCategories.filter(({ categories }) => categories.some((c) => wantCategories.has(c)))
              : withCategories;
          // 细化标签：中央派生职种/地区/语言/经验，并按监测条件过滤
          const tagged = categoryMatched
            .map(({ job: j, categories }) => ({
              job: j,
              categories,
              tags: deriveJobTags({
                title: j.title,
                company: j.company,
                location: j.location,
                snippet: j.snippet,
              }),
            }))
            .filter(({ job, tags }) =>
              matchesTags(
                tags,
                {
                  matchRoles: watch.matchRoles ?? [],
                  matchRegions: watch.matchRegions ?? [],
                  matchLanguages: watch.matchLanguages ?? [],
                  matchExperience: watch.matchExperience ?? [],
                },
                job.location,
              ),
            )
            // 硬门槛（确定性丢弃）：排除词命中 / 陈旧过滤
            .filter(({ job }) => passesHardGates(job, watch));
          if (tagged.length > 0) {
            // 构造入库行（复用原 cleanArr 清洗逻辑，由 buildJobRow 统一处理）
            const rows = tagged.map(({ job: j, categories, tags }) =>
              buildJobRow(watch, sourceId, j, categories, tags),
            );
            // 记录本轮出现的 externalId（差集判定停招用）
            let seen = seenBySource.get(sourceId);
            if (!seen) { seen = new Set<string>(); seenBySource.set(sourceId, seen); }
            for (const r of rows) seen.add(r.externalId);

            // 区分新增 / 已存在：新增批量插入；已存在逐条更新内容并清除停招（复活）
            const ids = rows.map((r) => r.externalId);
            const existing = await prisma.discoveredJob.findMany({
              where: { watchId: watch.id, source: sourceId, externalId: { in: ids } },
              select: { externalId: true },
            });
            const existingIds = new Set(existing.map((e) => e.externalId));
            const newRows = rows.filter((r) => !existingIds.has(r.externalId));
            const updRows = rows.filter((r) => existingIds.has(r.externalId));
            if (newRows.length > 0) {
              const res = await prisma.discoveredJob.createMany({ data: newRows, skipDuplicates: true });
              created += res.count;
              if (res.count > 0) usersWithNewJobs.add(watch.userId);
            }
            if (updRows.length > 0) {
              // 逐条更新（各岗位字段不同），并清除停招标记（重新出现=复活）
              await Promise.all(
                updRows.map((r) =>
                  prisma.discoveredJob.updateMany({
                    where: { watchId: watch.id, source: sourceId, externalId: r.externalId },
                    data: rowToUpdate(r),
                  }),
                ),
              );
              updated += updRows.length;
            }
            found += rows.length;
          }
        } catch (e) {
          errors.push(`${sourceId}/${keyword}: ${e instanceof Error ? e.message : String(e)}`);
        }
        // 仅在实际发起网络请求时礼貌延迟；缓存命中的关键词迭代（复用整板结果）跳过延迟，
        // 避免多关键词 watch 被无谓的 sleep 拖慢（如 14 关键词 watch 的 ~3700 次空等）。
        if (didFetch) await politeDelay();
      }
    }

    // 差集：本轮未在抓取结果中出现的在招岗位标记为停招（closedAt）
    const live = await prisma.discoveredJob.findMany({
      where: { watchId: watch.id, closedAt: null, status: { not: "dismissed" } },
      select: { id: true, source: true, externalId: true },
    });
    const toClose: string[] = [];
    for (const j of live) {
      const seen = seenBySource.get(j.source);
      if (!seen || !seen.has(j.externalId)) toClose.push(j.id);
    }
    if (toClose.length > 0) {
      const res = await prisma.discoveredJob.updateMany({
        where: { id: { in: toClose } },
        data: { closedAt: now },
      });
      closed += res.count;
    }

    // 清理：停招超过 14 天的岗位删除
    const cutoff = new Date(now.getTime() - CLOSE_GRACE_DAYS * 86_400_000);
    const delRes = await prisma.discoveredJob.deleteMany({
      where: { watchId: watch.id, closedAt: { lt: cutoff } },
    });
    deleted += delRes.count;

    await prisma.jobWatch.update({
      where: { id: watch.id },
      data: {
        lastRunAt: now,
        lastError: errors.length ? errors.join("；").slice(0, 1000) : null,
        lastResult: JSON.stringify({ scanned, created, updated, closed, deleted, found }),
      },
    });
  }

  // 有新岗位的用户：立即给未评分岗位打分（失败不影响轮询结果）
  for (const uid of usersWithNewJobs) {
    try {
      await scoreDiscoveredJobs(uid);
    } catch (e) {
      console.error(`[score] failed for ${uid}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { scanned, found, created, updated, closed, deleted };
}
