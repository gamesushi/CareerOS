// 直接（进程内）验证 154 个新 harvested 来源：绕过 BullMQ worker（避免被 5 分钟调度器
// 的 273×13 全量轮询单并发占满），逐个来源调用 search("") 并把结果 upsert 进一个
// enabled:false 的临时 watch（调度器会跳过它，不影响线上 7 个真实 watch）。
// 关键：只 import harvested.ts → greenhouse/ashby/lever 工厂（不触发 index.ts/finance.ts→Playwright OOM）。
import { prisma, Prisma } from "@careeros/db";
import { HARVESTED, HARVESTED_IDS } from "../src/sources/harvested";
import { deriveCategories } from "../src/sources/lib/category";
import { deriveJobTags, matchesTags } from "../src/sources/lib/taxonomy";
import type { JobCategory } from "../src/sources/lib/category";

const CONCURRENCY = 12;

function cleanArr(x: unknown): Prisma.InputJsonValue[] {
  return Array.isArray(x) ? (x.filter((v) => v != null) as Prisma.InputJsonValue[]) : [];
}

function buildJobRow(
  watch: { id: string; userId: string },
  sourceId: string,
  j: any,
  categories: JobCategory[],
  tags: any,
): Prisma.DiscoveredJobCreateManyInput {
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
  if (j.publishedAt instanceof Date && !Number.isNaN(j.publishedAt.getTime())) row.publishedAt = j.publishedAt;
  if (j.raw != null) row.raw = j.raw as Prisma.InputJsonValue;
  return row;
}

function rowToUpdate(r: Prisma.DiscoveredJobCreateManyInput): Prisma.DiscoveredJobUpdateInput {
  const { watchId: _w, userId: _u, source: _s, externalId: _e, ...rest } = r as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) if (v !== undefined) data[k] = v;
  data.closedAt = null;
  return data as unknown as Prisma.DiscoveredJobUpdateInput;
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= 2; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < 2) await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw new Error(`${label}: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("no user");
  const watch = await prisma.jobWatch.create({
    data: {
      userId: user.id,
      name: `TEMP-HARVEST-VERIFY-${Date.now()}`,
      sources: HARVESTED_IDS,
      keywords: [""],
      enabled: false,
    },
  });
  console.log(`临时 watch 已建 ${watch.id}，来源=${HARVESTED_IDS.length}，userId=${user.id}`);

  let scanned = 0;
  let found = 0;
  let created = 0;
  let updated = 0;
  const errors: string[] = [];
  const perSource: { id: string; jobs: number }[] = [];

  const ids = [...HARVESTED_IDS];
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (sourceId) => {
        const source = HARVESTED[sourceId];
        if (!source) return { sourceId, jobs: [] as any[], err: "unknown" };
        try {
          const jobs = await withRetry(() => source.search(""), sourceId);
          return { sourceId, jobs, err: null as string | null };
        } catch (e) {
          return { sourceId, jobs: [] as any[], err: e instanceof Error ? e.message : String(e) };
        }
      }),
    );
    for (const r of results) {
      scanned++;
      if (r.err) {
        errors.push(`${r.sourceId}: ${r.err}`);
        continue;
      }
      try {
      const keywordMatched = r.jobs;
      const withCats = keywordMatched.map((j) => ({
        job: j,
        categories: j.categories?.length ? j.categories : deriveCategories(`${j.title} ${j.snippet ?? ""}`, HARVESTED[r.sourceId]?.category),
      }));
      const tagged = withCats
        .map(({ job, categories }) => ({ job, categories, tags: deriveJobTags({ title: job.title, company: job.company, location: job.location, snippet: job.snippet }) }))
        .filter(({ job, tags }) =>
          matchesTags(tags, { matchRoles: [], matchRegions: [], matchLanguages: [], matchExperience: [] }, job.location),
        );
      if (tagged.length === 0) continue;
      const rows = tagged.map(({ job, categories, tags }) => buildJobRow(watch, r.sourceId, job, categories as JobCategory[], tags));
      found += rows.length;
      perSource.push({ id: r.sourceId, jobs: rows.length });

      const extIds = rows.map((x) => x.externalId);
      const existing = await prisma.discoveredJob.findMany({
        where: { watchId: watch.id, source: r.sourceId, externalId: { in: extIds } },
        select: { externalId: true },
      });
      const existingIds = new Set(existing.map((e) => e.externalId));
      const newRows = rows.filter((x) => !existingIds.has(x.externalId));
      const updRows = rows.filter((x) => existingIds.has(x.externalId));
      if (newRows.length) {
        const res = await prisma.discoveredJob.createMany({ data: newRows, skipDuplicates: true });
        created += res.count;
      }
      if (updRows.length) {
        await Promise.all(
          updRows.map((x) =>
            prisma.discoveredJob.updateMany({ where: { watchId: watch.id, source: r.sourceId, externalId: x.externalId }, data: rowToUpdate(x) }),
          ),
        );
        updated += updRows.length;
      }
      } catch (e) {
        errors.push(`${r.sourceId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    console.log(`  进度 ${Math.min(i + CONCURRENCY, ids.length)}/${ids.length}  累计 found=${found} created=${created}`);
  }

  perSource.sort((a, b) => b.jobs - a.jobs);
  console.log("\n==== 结果 ====");
  console.log(`来源总数=${scanned}  返回岗位=${found}  新增=${created}  更新=${updated}  错误=${errors.length}`);
  console.log("Top15 来源:");
  for (const p of perSource.slice(0, 15)) console.log(`  ${p.id.padEnd(28)} ${p.jobs}`);
  if (errors.length) {
    console.log("错误样例:");
    for (const e of errors.slice(0, 10)) console.log(`  ${e.slice(0, 120)}`);
  }
  console.log(`\n临时 watch 保留(enabled=false): ${watch.id} ，岗位已入库可供核验。`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FATAL", e);
    await prisma.$disconnect();
    process.exit(1);
  });
