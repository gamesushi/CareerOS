import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, buildApplicationEmail } from "@careeros/db";
import { assertPostingQuota } from "@/lib/limits";

// 通知内容构造 + 发帖配额。两者都不需要 mock 外部服务：
// 邮件内容是纯拼装（发送在 worker），配额是查库计数。

let employer = "";
let candidate = "";
let postingId = "";
let applicationId = "";

beforeAll(async () => {
  const s = Date.now();
  const [e, c] = await Promise.all([
    prisma.user.create({ data: { email: `nt-emp-${s}@test.local`, name: "招聘方老王", role: "recruiter" } }),
    prisma.user.create({ data: { email: `nt-cand-${s}@test.local`, name: "候选人小李" } }),
  ]);
  employer = e.id;
  candidate = c.id;

  const posting = await prisma.jobPosting.create({
    data: {
      postedByUserId: employer,
      orgType: "startup",
      company: "星海互娱",
      title: "关卡设计师",
      description: "岗位描述岗位描述岗位描述岗位描述岗位描述岗位描述",
      status: "open",
      reviewStatus: "approved",
    },
  });
  postingId = posting.id;

  const app = await prisma.jobApplication.create({
    data: { jobPostingId: postingId, candidateId: candidate },
  });
  applicationId = app.id;
});

afterAll(async () => {
  await prisma.jobPosting.deleteMany({ where: { postedByUserId: employer } });
  await prisma.user.deleteMany({ where: { id: { in: [employer, candidate] } } });
  await prisma.$disconnect();
});

describe("通知内容", () => {
  it("新投递 → 发给雇主，正文含候选人与岗位", async () => {
    const mail = await buildApplicationEmail(prisma, "application_submitted", applicationId);
    expect(mail).not.toBeNull();
    expect(mail!.to).toContain("nt-emp-");
    expect(mail!.subject).toContain("星海互娱 · 关卡设计师");
    expect(mail!.text).toContain("候选人小李");
  });

  it("状态变更 → 发给候选人，带中文状态label", async () => {
    await prisma.jobApplication.update({ where: { id: applicationId }, data: { status: "interview" } });
    const mail = await buildApplicationEmail(prisma, "application_status_changed", applicationId);
    expect(mail!.to).toContain("nt-cand-");
    expect(mail!.subject).toContain("进入面试");
  });

  it("候选人自己撤回不发信给他自己", async () => {
    await prisma.jobApplication.update({ where: { id: applicationId }, data: { status: "withdrawn" } });
    expect(await buildApplicationEmail(prisma, "application_status_changed", applicationId)).toBeNull();
  });

  it("投递已删 → 返回 null 而不是抛错（队列任务不该因此反复重试）", async () => {
    expect(
      await buildApplicationEmail(prisma, "application_submitted", "00000000-0000-0000-0000-000000000000"),
    ).toBeNull();
  });

  it("HTML 里的用户内容被转义（公司名可含 < >）", async () => {
    await prisma.jobPosting.update({
      where: { id: postingId },
      data: { company: '<script>alert(1)</script>' },
    });
    const mail = await buildApplicationEmail(prisma, "application_submitted", applicationId);
    expect(mail!.html).not.toContain("<script>");
    expect(mail!.html).toContain("&lt;script&gt;");
  });
});

describe("发帖配额", () => {
  it("未超额时放行并返回用量", async () => {
    const r = await assertPostingQuota(employer, 10);
    expect(r.used).toBe(1); // beforeAll 里建了一个
    expect(r.limit).toBe(10);
  });

  it("达到上限 → 429", async () => {
    await expect(assertPostingQuota(employer, 1)).rejects.toMatchObject({
      status: 429,
      code: "posting_quota",
    });
  });

  // 记录当前实现的已知空子：额度按现存记录算，删掉旧岗位能腾出额度。
  // 堵死需要独立的用量流水表，本期刻意不做（见 lib/limits.ts 注释）。
  it("草稿计入额度；删掉后额度会被腾出（已知空子）", async () => {
    const draft = await prisma.jobPosting.create({
      data: {
        postedByUserId: employer,
        orgType: "startup",
        company: "X",
        title: "草稿",
        description: "岗位描述岗位描述岗位描述岗位描述岗位描述岗位描述",
        status: "draft",
      },
    });
    await expect(assertPostingQuota(employer, 2)).rejects.toMatchObject({ status: 429 });
    await prisma.jobPosting.delete({ where: { id: draft.id } });
    await expect(assertPostingQuota(employer, 2)).resolves.toBeTruthy();
  });
});
