import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@careeros/db";
import { listPublicPostings, listMyPostings } from "@/lib/job-postings";
import { listPostingReviewQueue, reviewJobPosting, takedownPosting } from "@/lib/admin/jobs";

// 真实 DB 集成测试：验证 B 端发布岗的三道可见性闸门（status / reviewStatus / takenDownAt）
// 与审核队列的行为。这些是 mock 覆盖不了的部分——闸门写在 Prisma where 里。

let employer = "";
let admin = "";
let draftId = "";
let pendingId = "";
let approvedId = "";
let closedId = "";

const base = {
  posterRole: "hr" as const,
  companyStage: "startup_0_3" as const,
  company: "测试公司",
  description: "岗位描述岗位描述岗位描述岗位描述岗位描述岗位描述岗位描述岗位描述",
};

beforeAll(async () => {
  const stamp = Date.now();
  const [e, a] = await Promise.all([
    prisma.user.create({ data: { email: `jp-emp-${stamp}@test.local`, name: "Emp", role: "recruiter" } }),
    prisma.user.create({ data: { email: `jp-admin-${stamp}@test.local`, name: "Admin", role: "admin" } }),
  ]);
  employer = e.id;
  admin = a.id;

  const mk = (title: string, over: Record<string, unknown>) =>
    prisma.jobPosting.create({
      data: { ...base, title, postedByUserId: employer, ...over },
      select: { id: true },
    });

  [draftId, pendingId, approvedId, closedId] = (
    await Promise.all([
      mk("草稿岗", { status: "draft" }),
      mk("待审岗", { status: "open", reviewStatus: "pending" }),
      mk("已过审岗", { status: "open", reviewStatus: "approved" }),
      mk("已下架岗", { status: "closed", reviewStatus: "approved" }),
    ])
  ).map((r) => r.id);
});

afterAll(async () => {
  await prisma.jobPosting.deleteMany({ where: { postedByUserId: employer } });
  await prisma.user.deleteMany({ where: { id: { in: [employer, admin] } } });
  await prisma.$disconnect();
});

describe("候选端公共流的可见性闸门", () => {
  it("只放行 open + approved + 未下架", async () => {
    const ids = (await listPublicPostings()).map((p) => p.id);
    expect(ids).toContain(approvedId);
    expect(ids).not.toContain(draftId); // 草稿不外露
    expect(ids).not.toContain(pendingId); // 未过审不外露
    expect(ids).not.toContain(closedId); // 发布者已下架
  });

  it("管理员下架后即时消失，恢复后回归", async () => {
    await takedownPosting(approvedId, false, admin);
    expect((await listPublicPostings()).map((p) => p.id)).not.toContain(approvedId);

    await takedownPosting(approvedId, true, admin);
    expect((await listPublicPostings()).map((p) => p.id)).toContain(approvedId);
  });

  it("公共流不带 userId 条件——所有候选人看到同一批（与 DiscoveredJob 的行级隔离不同）", async () => {
    const rows = await listPublicPostings();
    // 返回形状里刻意不含 postedByUserId，避免把发布者身份泄给候选端
    expect(rows.every((r) => !("postedByUserId" in r))).toBe(true);
  });
});

describe("我的发布", () => {
  it("发布者能看到自己全部四条（含草稿与待审）", async () => {
    const ids = (await listMyPostings(employer)).map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining([draftId, pendingId, approvedId, closedId]));
  });

  it("看不到别人的发布", async () => {
    expect(await listMyPostings(admin)).toHaveLength(0);
  });
});

describe("管理端审核队列", () => {
  it("待审队列含已提交的、不含草稿", async () => {
    const { rows } = await listPostingReviewQueue({ filter: "pending" });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(pendingId);
    expect(ids).not.toContain(draftId);
  });

  it("通过后进入公共流，拒绝后带理由退出", async () => {
    expect(await reviewJobPosting(pendingId, "approved", admin)).not.toBeNull();
    expect((await listPublicPostings()).map((p) => p.id)).toContain(pendingId);

    await reviewJobPosting(pendingId, "rejected", admin, "岗位信息不完整");
    expect((await listPublicPostings()).map((p) => p.id)).not.toContain(pendingId);
    const mine = await listMyPostings(employer);
    expect(mine.find((p) => p.id === pendingId)).toMatchObject({
      reviewStatus: "rejected",
      reviewNote: "岗位信息不完整",
    });
  });

  it("草稿不可被审核（兜底误操作）", async () => {
    expect(await reviewJobPosting(draftId, "approved", admin)).toBeNull();
  });
});
