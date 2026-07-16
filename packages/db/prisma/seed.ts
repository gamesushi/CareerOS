import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 开发种子：一个演示用户 + 一段最小职业数据，方便 UI 联调
async function main() {
  const user = await prisma.user.upsert({
    where: { email: "dev@careeros.local" },
    update: {},
    create: {
      email: "dev@careeros.local",
      name: "Dev User",
      locale: "zh",
      jobStatus: "open",
      careerProfile: { create: { headline: "示例：海外游戏发行专家" } },
    },
  });

  const exp = await prisma.careerExperience.create({
    data: {
      userId: user.id,
      company: "示例株式会社",
      companyNorm: "示例株式会社",
      title: "海外发行经理",
      startDate: new Date("2022-04-01"),
      location: "东京",
      description: "负责日本市场手游发行与本地化运营。",
      highlights: ["主导 3 款手游日本上线", "搭建本地化流程"],
    },
  });

  const skill = await prisma.skill.create({
    data: {
      userId: user.id,
      name: "市场分析",
      nameNorm: "市场分析",
      category: "domain",
      level: 70,
      levelSource: "manual",
    },
  });

  await prisma.skillEvidence.create({
    data: {
      skillId: skill.id,
      sourceType: "experience",
      sourceId: exp.id,
      note: "日本手游市场季度分析报告",
      weight: 3,
    },
  });

  console.log(`Seeded dev user: ${user.email} (${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
