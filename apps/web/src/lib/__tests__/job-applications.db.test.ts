import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@careeros/db";
import {
  assertApplicable,
  assertTransition,
  listApplicationsForPosting,
  listMyApplications,
  requireEmployerOnApplication,
  requireEmployerOnPosting,
} from "@/lib/job-applications";

// 真实 DB 集成测试。重点是**隐私边界**：谁能看到哪条投递、谁看不到。
// 这类判定一旦回归就是数据泄露，必须有网。

let employer = "";
let coworker = "";
let outsider = "";
let candidate = "";
let orgId = "";
let orgPostingId = "";
let soloPostingId = "";
let draftPostingId = "";
let applicationId = "";

beforeAll(async () => {
  const s = Date.now();
  const [e, c, o, cand] = await Promise.all([
    prisma.user.create({ data: { email: `ja-emp-${s}@test.local`, name: "Emp", role: "recruiter" } }),
    prisma.user.create({ data: { email: `ja-cow-${s}@test.local`, name: "Coworker", role: "recruiter" } }),
    prisma.user.create({ data: { email: `ja-out-${s}@test.local`, name: "Outsider", role: "recruiter" } }),
    prisma.user.create({ data: { email: `ja-cand-${s}@test.local`, name: "Candidate" } }),
  ]);
  employer = e.id;
  coworker = c.id;
  outsider = o.id;
  candidate = cand.id;

  const org = await prisma.organization.create({
    data: {
      slug: `ja-org-${s}`,
      name: "JA Org",
      orgType: "startup",
      members: { create: [{ userId: employer, role: "owner" }, { userId: coworker, role: "recruiter" }] },
    },
  });
  orgId = org.id;

  const base = {
    postedByUserId: employer,
    posterRole: "hr" as const,
    companyStage: "startup_0_3" as const,
    company: "JA Org",
    description: "岗位描述岗位描述岗位描述岗位描述岗位描述岗位描述",
  };
  const [orgPost, solo, draft] = await Promise.all([
    prisma.jobPosting.create({
      data: { ...base, orgId, title: "组织岗", status: "open", reviewStatus: "approved" },
    }),
    prisma.jobPosting.create({
      data: { ...base, title: "个人岗", status: "open", reviewStatus: "approved" },
    }),
    prisma.jobPosting.create({ data: { ...base, title: "草稿岗", status: "draft" } }),
  ]);
  orgPostingId = orgPost.id;
  soloPostingId = solo.id;
  draftPostingId = draft.id;

  const app = await prisma.jobApplication.create({
    data: { jobPostingId: orgPostingId, candidateId: candidate, coverLetter: "我很合适" },
  });
  applicationId = app.id;
});

afterAll(async () => {
  await prisma.jobPosting.deleteMany({ where: { postedByUserId: employer } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.user.deleteMany({ where: { id: { in: [employer, coworker, outsider, candidate] } } });
  await prisma.$disconnect();
});

describe("可投递性", () => {
  it("已过审在招岗可投", async () => {
    await expect(assertApplicable(orgPostingId, candidate)).resolves.toBeTruthy();
  });

  it("草稿岗不可投", async () => {
    await expect(assertApplicable(draftPostingId, candidate)).rejects.toMatchObject({
      status: 409,
      code: "not_open",
    });
  });

  it("不能投自己发布的岗", async () => {
    await expect(assertApplicable(orgPostingId, employer)).rejects.toMatchObject({
      status: 400,
      code: "self_apply",
    });
  });

  it("重复投递被唯一键挡下（P2002）", async () => {
    await expect(
      prisma.jobApplication.create({ data: { jobPostingId: orgPostingId, candidateId: candidate } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});

describe("隐私边界：谁能看到这条投递", () => {
  it("发布者本人可以", async () => {
    await expect(requireEmployerOnApplication(applicationId, employer)).resolves.toBeTruthy();
  });

  it("同组织的其他成员可以（组织岗是团队共享的）", async () => {
    await expect(requireEmployerOnApplication(applicationId, coworker)).resolves.toBeTruthy();
  });

  it("无关的第三方不行——即使他自己也是 recruiter、也知道投递 id", async () => {
    await expect(requireEmployerOnApplication(applicationId, outsider)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("候选人本人走的不是雇主这条路径，同样被这里拒绝", async () => {
    await expect(requireEmployerOnApplication(applicationId, candidate)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("个人名义岗只有发布者能看，同组织同事也不行", async () => {
    await expect(requireEmployerOnPosting(soloPostingId, employer)).resolves.toBeTruthy();
    await expect(requireEmployerOnPosting(soloPostingId, coworker)).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("字段可见性", () => {
  it("候选人侧的「我投过的」不含雇主备注", async () => {
    await prisma.jobApplication.update({
      where: { id: applicationId },
      data: { employerNote: "内部评价：待定" },
    });
    const mine = await listMyApplications(candidate);
    expect(mine).toHaveLength(1);
    expect(JSON.stringify(mine)).not.toContain("内部评价");
  });

  it("雇主侧的收件箱含备注与候选人联系方式", async () => {
    const rows = await listApplicationsForPosting(orgPostingId);
    expect(rows[0].employerNote).toBe("内部评价：待定");
    expect(rows[0].candidate.email).toContain("ja-cand-");
  });
});

describe("状态机", () => {
  it("雇主可推进，但不能替候选人撤回", () => {
    expect(() => assertTransition("submitted", "interview", "employer")).not.toThrow();
    expect(() => assertTransition("submitted", "withdrawn", "employer")).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });

  it("候选人只能撤回，不能自己发 offer", () => {
    expect(() => assertTransition("submitted", "withdrawn", "candidate")).not.toThrow();
    expect(() => assertTransition("submitted", "offer", "candidate")).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  it("终态不可再流转", () => {
    for (const terminal of ["offer", "rejected", "withdrawn"] as const) {
      expect(() => assertTransition(terminal, "screening", "employer")).toThrow(
        expect.objectContaining({ status: 409 }),
      );
    }
  });
});

describe("简历删除", () => {
  it("候选人删简历，投递记录仍在（resumeId 置空）", async () => {
    const resume = await prisma.resume.create({
      data: {
        userId: candidate,
        title: "临时简历",
        resumeType: "zh",
        resumeJson: {},
      },
    });
    const app = await prisma.jobApplication.create({
      data: { jobPostingId: soloPostingId, candidateId: candidate, resumeId: resume.id },
    });

    await prisma.resume.delete({ where: { id: resume.id } });

    const after = await prisma.jobApplication.findUnique({
      where: { id: app.id },
      select: { id: true, resumeId: true },
    });
    expect(after).not.toBeNull();
    expect(after!.resumeId).toBeNull();
  });
});
