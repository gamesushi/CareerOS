// 清理：① 从所有 enabled JobWatch 的 sources 数组中移除 2 个超长/非法 harvested id
// （jobs-page-<uuid> 46 字符、sponsorsforeducationalopportunity 33 字符，均超过 source 列 VarChar(32)）；
// ② 删除此前验证遗留的孤儿临时 watch（名称含 TEMP-HARVEST-VERIFY，enabled=false），只保留最新一个。
import { prisma } from "@careeros/db";

const BAD = [
  "jobs-page-4dc2685b-eb82-46d1-a3f9-1f0764dba814",
  "sponsorsforeducationalopportunity",
];

async function main() {
  const watches = await prisma.jobWatch.findMany({ where: { enabled: true } });
  for (const w of watches) {
    const before = w.sources.length;
    const after = w.sources.filter((s) => !BAD.includes(s));
    if (after.length !== before) {
      await prisma.jobWatch.update({ where: { id: w.id }, data: { sources: after } });
      console.log(`watch ${w.id.slice(0, 8)} (${w.name}): sources ${before} -> ${after.length} (移除 ${before - after.length})`);
    } else {
      console.log(`watch ${w.id.slice(0, 8)} (${w.name}): 无需清理`);
    }
  }

  const temp = await prisma.jobWatch.findMany({
    where: { name: { contains: "TEMP-HARVEST-VERIFY" } },
    orderBy: { createdAt: "desc" },
  });
  if (temp.length > 1) {
    const keep = temp[0];
    const drop = temp.slice(1);
    for (const d of drop) {
      await prisma.jobWatch.delete({ where: { id: d.id } });
      console.log(`删除孤儿临时 watch ${d.id.slice(0, 8)} (${d.createdAt.toISOString()})，保留 ${keep.id.slice(0, 8)}`);
    }
  } else {
    console.log(`临时 watch 共 ${temp.length} 个，无需清理`);
  }
  console.log("done");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FATAL", e);
    await prisma.$disconnect();
    process.exit(1);
  });
