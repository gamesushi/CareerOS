import { prisma, Prisma } from "@careeros/db";
import { SOURCES } from "../sources";
import { politeDelay } from "../sources/types";

// 岗位监测轮询：调度器每 5 分钟触发一次扫描，处理"到期"的监测任务
// （enabled 且 距上次运行 ≥ intervalMinutes）。手动触发时直接传 watchId。
// 新岗位按 (watch, source, externalId) 去重入库，状态 new，等待用户处理。

export async function handleWatchPollJob(watchId?: string): Promise<{ scanned: number; found: number }> {
  const now = new Date();
  const watches = watchId
    ? await prisma.jobWatch.findMany({ where: { id: watchId } })
    : await prisma.jobWatch.findMany({ where: { enabled: true } });

  let scanned = 0;
  let found = 0;

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
          const jobs = await source.search(keyword);
          let filtered =
            watch.locations.length === 0
              ? jobs
              : jobs.filter(
                  (j) => !j.location || watch.locations.some((loc) => j.location!.includes(loc)),
                );
          // 品类匹配：若监测任务指定了匹配品类，只保留命中品类的岗位
          if (watch.matchCategories && watch.matchCategories.length > 0) {
            const want = new Set(watch.matchCategories);
            filtered = filtered.filter((j) =>
              (j.categories ?? []).some((c) => want.has(c)),
            );
          }
          if (filtered.length > 0) {
            const result = await prisma.discoveredJob.createMany({
              data: filtered.map((j) => ({
                watchId: watch.id,
                userId: watch.userId,
                source: sourceId,
                externalId: j.externalId,
                title: j.title.slice(0, 200),
                company: j.company?.slice(0, 128),
                location: j.location?.slice(0, 128),
                salary: j.salary?.slice(0, 64),
                url: j.url,
                snippet: j.snippet,
                publishedAt: j.publishedAt,
                categories: (j.categories ?? []) as Prisma.InputJsonValue,
                raw: (j.raw ?? undefined) as Prisma.InputJsonValue | undefined,
              })),
              skipDuplicates: true, // 唯一键 (watch_id, source, external_id) 去重
            });
            found += result.count;
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

  return { scanned, found };
}
