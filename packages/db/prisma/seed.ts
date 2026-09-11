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

  await seedTokenPrices();
  await backfillTokenBalances();
}

// ============ Token 系统种子（docs/token-system-plan.md §3.2 / Phase 0） ============

// 2026-09-11 现行单价（¥ / 1K token）。DeepSeek 2026-08 集体涨价后口径。
const TOKEN_PRICES = [
  { model: "deepseek-chat", label: "DeepSeek V3.2 (deepseek-chat)", inPer1k: 0.002, outPer1k: 0.003 },
  { model: "deepseek-v4-flash", label: "DeepSeek V4-Flash", inPer1k: 0.0008, outPer1k: 0.0016 },
  { model: "deepseek-v4-pro", label: "DeepSeek V4-Pro", inPer1k: 0.0045, outPer1k: 0.0135 },
  { model: "gpt-4.1-mini", label: "OpenAI GPT-4.1-mini", inPer1k: 0.00288, outPer1k: 0.01152 },
  { model: "text-embedding-3-small", label: "OpenAI text-embedding-3-small", inPer1k: 0.000144, outPer1k: 0 },
];

// 免费额度分档（一次性赠送，不刷新）
const TIER_FREE = { c: 30000, b: 100000 } as const;

async function seedTokenPrices() {
  for (const p of TOKEN_PRICES) {
    await prisma.tokenPrice.upsert({
      where: { model: p.model },
      update: { label: p.label, inPer1k: p.inPer1k, outPer1k: p.outPer1k },
      create: p,
    });
  }
  console.log(`Seeded ${TOKEN_PRICES.length} token prices`);
}

// 给所有尚无余额行的账号按角色补发免费额度（远程生产库一次性 materialize，供成本看板）
async function backfillTokenBalances() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, role: true, orgMemberships: { select: { id: true } } },
  });
  let created = 0;
  for (const u of users) {
    const exists = await prisma.tokenBalance.findUnique({ where: { userId: u.id }, select: { id: true } });
    if (exists) continue;
    const isB =
      u.role === "recruiter" || u.role === "enterprise" || u.role === "admin" || (u.orgMemberships?.length ?? 0) > 0;
    const free = isB ? TIER_FREE.b : TIER_FREE.c;
    await prisma.tokenBalance.create({ data: { userId: u.id, balance: free, freeQuota: free, tier: isB ? "b" : "c" } });
    created++;
  }
  console.log(`Backfilled ${created} token balances (scanned ${users.length} users)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
