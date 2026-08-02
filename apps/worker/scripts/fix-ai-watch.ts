import { prisma } from "@careeros/db";

async function main() {
  // 「AI 岗位追踪」：补英文 AI 关键词，让英文 AI 公司岗位能命中
  const aiWatch = await prisma.jobWatch.findFirst({ where: { name: "AI 岗位追踪" } });
  if (!aiWatch) { console.log("AI 岗位追踪 watch not found"); process.exit(1); }
  const aiKw = [
    "大模型", "LLM", "Agent",
    "AI", "ML", "machine learning", "artificial intelligence",
    "engineer", "research", "scientist", "developer", "research scientist",
    "工程师", "研究员",
  ];
  await prisma.jobWatch.update({ where: { id: aiWatch.id }, data: { keywords: aiKw } });
  console.log(`updated [AI 岗位追踪] id=${aiWatch.id} keywords=${aiKw.length}`);

  // 「Bootstrap EN」：确认英文关键词，能抓 AI 公司 engineer 岗
  const enWatch = await prisma.jobWatch.findFirst({ where: { name: "Bootstrap EN" } });
  if (enWatch) {
    const enKw = ["engineer", "product manager", "developer", "scientist", "designer", "researcher", "data"];
    await prisma.jobWatch.update({ where: { id: enWatch.id }, data: { keywords: enKw } });
    console.log(`updated [Bootstrap EN] id=${enWatch.id} keywords=${enKw.length}`);
  }

  console.log(`\nAI watch id=${aiWatch.id}`);
  console.log(`EN watch id=${enWatch?.id}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
