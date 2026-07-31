import { prisma, Prisma } from "@careeros/db";
import { SOURCES } from "../sources";
import { politeDelay } from "../sources/types";
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

export async function handleWatchPollJob(watchId?: string): Promise<{ scanned: number; found: number }> {
  const now = new Date();
  const watches = watchId
    ? await prisma.jobWatch.findMany({ where: { id: watchId } })
    : await prisma.jobWatch.findMany({ where: { enabled: true } });

  let scanned = 0;
  let found = 0;
  const usersWithNewJobs = new Set<string>();

  for (const watch of watches) {
    // 定时扫描时只处理到期任务；手动触发（watchId 指定）不受间隔限制
    if (!watchId && watch.lastRunAt) {
      const dueAt = watch.lastRunAt.getTime() + watch.intervalMinutes * 60_000;
      if (dueAt > now.getTime()) continue;
    }
    scanned++;

    const errors: string[] = [];
    for (const sourceId of watch.sources) {
      const source = SOURCES[sourceId];
      if (!source) {
        errors.push(`未知来源 ${sourceId}`);
        continue;
      }
      for (const keyword of watch.keywords) {
        try {
          const jobs = await withRetry(
            () => source.search(keyword),
            { retries: 2, delayMs: 1000, label: `${sourceId}/${keyword}` },
          );
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
            // 可选字段仅在确有值时设置：Prisma createMany 不接受 undefined，
            // 否则 remoteok / hackernews 等不返回 salary 的源会整批写入失败。
            const data: Prisma.DiscoveredJobCreateManyInput[] = tagged.map(
              ({ job: j, categories, tags }) => {
                // Json 标签字段既可能因整字段为 undefined、也可能因数组内含
                // undefined 元素（deriveJobTags/deriveCategories 的边界情况）而让
                // 整批 createMany 报 Invalid invocation。统一清洗为「不含 null/undefined
                // 元素的数组」，避免单条脏数据拖垮整批写入。
                const cleanArr = (x: unknown): Prisma.InputJsonValue[] =>
                  Array.isArray(x)
                    ? (x.filter((v) => v != null) as Prisma.InputJsonValue[])
                    : [];
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
                // publishedAt 必须是有效 Date：源解析失败会产生 Invalid Date 对象，
                // 直接传入 DateTime 字段会让整批 createMany 报 Invalid invocation。
                if (j.publishedAt instanceof Date && !Number.isNaN(j.publishedAt.getTime())) {
                  row.publishedAt = j.publishedAt;
                }
                if (j.raw != null) row.raw = j.raw as Prisma.InputJsonValue;
                return row;
              },
            );
            const result = await prisma.discoveredJob.createMany({
              data,
              skipDuplicates: true, // 唯一键 (watch_id, source, external_id) 去重
            });
            found += result.count;
            if (result.count > 0) usersWithNewJobs.add(watch.userId);
          }
        } catch (e) {
          errors.push(`${sourceId}/${keyword}: ${e instanceof Error ? e.message : String(e)}`);
        }
        await politeDelay();
      }
    }

    await prisma.jobWatch.update({
      where: { id: watch.id },
      data: { lastRunAt: now, lastError: errors.length ? errors.join("；").slice(0, 1000) : null },
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

  return { scanned, found };
}
