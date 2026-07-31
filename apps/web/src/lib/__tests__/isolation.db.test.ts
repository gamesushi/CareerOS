import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@careeros/db";
import { getInsights } from "@/lib/insights";

// 真实 DB 集成测试：验证行级隔离（用户 A 拿不到 B 的数据）与 getInsights 的正确性。
// 由 vitest.db.config.ts 驱动（独立测试库，globalSetup 建库+迁移）。

let userA = "";
let userB = "";
let bAppId = "";

beforeAll(async () => {
  const stamp = Date.now();
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { email: `iso-a-${stamp}@test.local`, name: "Iso A" } }),
    prisma.user.create({ data: { email: `iso-b-${stamp}@test.local`, name: "Iso B" } }),
  ]);
  userA = a.id;
  userB = b.id;

  await prisma.application.create({
    data: { userId: userA, title: "A job", stage: "applied", events: { create: { kind: "created" } } },
  });
  const bApp = await prisma.application.create({
    data: {
      userId: userB,
      title: "B job",
      stage: "interview",
      events: {
        create: [
          { kind: "created" },
          { kind: "stage_change", fromStage: "considering", toStage: "interview" },
        ],
      },
    },
  });
  bAppId = bApp.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } }); // cascade → applications/events
  await prisma.$disconnect();
});

describe("行级隔离（真实 DB）", () => {
  it("getInsights 只统计本人申请，不串号", async () => {
    expect((await getInsights(userA)).total).toBe(1);
    expect((await getInsights(userB)).total).toBe(1);
  });

  it("owned 查询：A 用自己的 id 拿不到 B 的申请（route 的 findFirst where userId 模式）", async () => {
    expect(await prisma.application.findFirst({ where: { id: bAppId, userId: userA } })).toBeNull();
    expect(await prisma.application.findFirst({ where: { id: bAppId, userId: userB } })).not.toBeNull();
  });

  it("findMany(where userId) 只返回本人数据", async () => {
    const aApps = await prisma.application.findMany({ where: { userId: userA } });
    expect(aApps.length).toBe(1);
    expect(aApps.every((x) => x.userId === userA)).toBe(true);
  });

  it("getInsights 漏斗从 ApplicationEvent 复原：B 曾到达 interview", async () => {
    const insB = await getInsights(userB);
    expect(insB.funnel.find((f) => f.stage === "interview")?.count).toBe(1);
    expect(insB.funnel.find((f) => f.stage === "offer")?.count).toBe(0);
  });
});
