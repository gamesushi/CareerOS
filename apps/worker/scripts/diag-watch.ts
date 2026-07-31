import { prisma, Prisma } from "@careeros/db";
import { SOURCES } from "../src/sources/index.ts";
import { deriveCategories } from "../src/sources/lib/category.ts";
import { deriveJobTags, matchesTags } from "../src/sources/lib/taxonomy.ts";

const watchId = process.argv[2];
if (!watchId) {
  console.error("usage: node diag.ts <watchId>");
  process.exit(1);
}

const watch = await prisma.jobWatch.findFirst({ where: { id: watchId } });
if (!watch) {
  console.error("watch not found:", watchId);
  process.exit(1);
}
console.log(`\n=== WATCH: ${watch.name} ===`);
console.log("sources:", JSON.stringify(watch.sources));
console.log("keywords:", JSON.stringify(watch.keywords));
console.log("matchCategories:", JSON.stringify(watch.matchCategories), "matchRoles:", JSON.stringify(watch.matchRoles));

for (const sourceId of watch.sources) {
  const source = SOURCES[sourceId];
  if (!source) {
    console.log(`  [${sourceId}] 未知来源`);
    continue;
  }
  for (const keyword of watch.keywords) {
    let jobs: any[] = [];
    try {
      jobs = await source.search(keyword);
    } catch (e: any) {
      console.log(`  [${sourceId}/${keyword}] SEARCH ERROR: ${e?.message ?? e}`);
      continue;
    }
    const kw = keyword.trim().toLowerCase();
    const afterKw = kw ? jobs.filter((j: any) => `${j.title ?? ""} ${j.snippet ?? ""}`.toLowerCase().includes(kw)) : jobs;
    const withCat = afterKw.map((j: any) => ({
      job: j,
      categories: j.categories?.length ? j.categories : deriveCategories(`${j.title} ${j.snippet ?? ""}`, source.category),
    }));
    let afterCat = withCat;
    if (watch.matchCategories?.length) {
      const want = new Set(watch.matchCategories);
      afterCat = withCat.filter(({ categories }: any) => categories.some((c: string) => want.has(c)));
    }
    const tagged = afterCat
      .map(({ job: j, categories }: any) => ({ job: j, categories, tags: deriveJobTags({ title: j.title, company: j.company, location: j.location, snippet: j.snippet }) }))
      .filter(({ job, tags }: any) =>
        matchesTags(tags, { matchRoles: watch.matchRoles ?? [], matchRegions: watch.matchRegions ?? [], matchLanguages: watch.matchLanguages ?? [], matchExperience: watch.matchExperience ?? [] }, job.location),
      );
    const mark = tagged.length > 0 ? ">> FOUND" : "";
    console.log(`  [${sourceId}/${keyword}] raw=${jobs.length} kw=${afterKw.length} cat=${afterCat.length} final=${tagged.length} ${mark}`);
    if (tagged.length > 0) {
      for (const t of tagged.slice(0, 3)) console.log(`      - ${t.job.title}  roles=${JSON.stringify(t.tags.roles)} cats=${JSON.stringify(t.categories)}`);
    }
  }
}
await prisma.$disconnect();
