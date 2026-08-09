import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@careeros/db";
import { slugify } from "@careeros/shared";
import {
  createOrganization,
  getPublicOrganization,
  listMyOrganizations,
  requireOrgMember,
  uniqueSlug,
} from "@/lib/organizations";

// 真实 DB 集成测试：组织实体的三件事——slug 唯一、成员门禁、公司主页可见性闸门。
// 这些都写在 Prisma 查询与事务里，mock 覆盖不到。

let owner = "";
let outsider = "";
let orgId = "";
let orgSlug = "";

beforeAll(async () => {
  const stamp = Date.now();
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { email: `org-own-${stamp}@test.local`, name: "Owner", role: "recruiter" } }),
    prisma.user.create({ data: { email: `org-out-${stamp}@test.local`, name: "Outsider", role: "recruiter" } }),
  ]);
  owner = a.id;
  outsider = b.id;

  const org = await createOrganization(owner, {
    slug: await uniqueSlug("acme-tech"),
    name: "Acme Tech",
    orgType: "startup",
  });
  orgId = org.id;
  orgSlug = org.slug;
});

afterAll(async () => {
  await prisma.jobPosting.deleteMany({ where: { postedByUserId: { in: [owner, outsider] } } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.user.deleteMany({ where: { id: { in: [owner, outsider] } } });
  await prisma.$disconnect();
});

describe("建组织", () => {
  it("创建者自动成为 owner 成员（同事务，不会留下没有成员的孤儿组织）", async () => {
    expect(await requireOrgMember(orgId, owner)).toBe("owner");
    const mine = await listMyOrganizations(owner);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ id: orgId, myRole: "owner" });
  });

  it("非成员看不到，也过不了成员门禁", async () => {
    expect(await listMyOrganizations(outsider)).toHaveLength(0);
    await expect(requireOrgMember(orgId, outsider)).rejects.toMatchObject({
      status: 403,
      code: "not_org_member",
    });
  });

  it("owner 不满足「需要 admin」以外的角色约束时按角色表判定", async () => {
    // owner 在 [owner, admin] 白名单内 → 放行；不在白名单则 403
    await expect(requireOrgMember(orgId, owner, ["owner", "admin"])).resolves.toBe("owner");
    await expect(requireOrgMember(orgId, owner, ["recruiter"])).rejects.toMatchObject({ status: 403 });
  });
});

describe("slug", () => {
  it("撞车时自动加后缀而不是报错", async () => {
    const second = await uniqueSlug(orgSlug);
    expect(second).not.toBe(orgSlug);
    expect(second.startsWith(orgSlug)).toBe(true);
  });

  it("编辑自己时不与自己冲突", async () => {
    expect(await uniqueSlug(orgSlug, orgId)).toBe(orgSlug);
  });

  it("纯中文名生成不出 ascii → 回落随机 slug，而不是空串", async () => {
    const s = slugify("星海互娱");
    expect(s.startsWith("org-")).toBe(true);
    expect(s.length).toBeGreaterThan(4);
  });
});

describe("公开公司主页", () => {
  it("只出该组织已过审、在招、未下架的岗", async () => {
    const base = {
      postedByUserId: owner,
      orgId,
      posterRole: "hr" as const,
      companyStage: "startup_0_3" as const,
      company: "Acme Tech",
      description: "岗位描述岗位描述岗位描述岗位描述岗位描述岗位描述",
    };
    const mk = (title: string, over: Record<string, unknown>) =>
      prisma.jobPosting.create({ data: { ...base, title, ...over }, select: { id: true } });

    const [visible, pending, closed, takenDown, otherOrg] = await Promise.all([
      mk("可见岗", { status: "open", reviewStatus: "approved" }),
      mk("待审岗", { status: "open", reviewStatus: "pending" }),
      mk("已下架岗", { status: "closed", reviewStatus: "approved" }),
      mk("被管理员下架", { status: "open", reviewStatus: "approved", takenDownAt: new Date() }),
      // 同一发布者、不挂组织的岗，不该出现在公司主页上
      prisma.jobPosting.create({
        data: { ...base, orgId: null, title: "个人名义岗", status: "open", reviewStatus: "approved" },
        select: { id: true },
      }),
    ]);

    const page = await getPublicOrganization(orgSlug);
    expect(page).not.toBeNull();
    const ids = page!.postings.map((p) => p.id);
    expect(ids).toContain(visible.id);
    expect(ids).not.toContain(pending.id);
    expect(ids).not.toContain(closed.id);
    expect(ids).not.toContain(takenDown.id);
    expect(ids).not.toContain(otherOrg.id);
  });

  it("slug 不存在返回 null（页面走 notFound）", async () => {
    expect(await getPublicOrganization("no-such-company")).toBeNull();
  });
});

describe("删组织", () => {
  it("岗位不跟着消失，只是退化为个人发布（orgId 置空）", async () => {
    const tmp = await createOrganization(owner, { slug: await uniqueSlug("temp-co"), name: "Temp Co", orgType: "startup" });
    const posting = await prisma.jobPosting.create({
      data: {
        postedByUserId: owner,
        orgId: tmp.id,
        posterRole: "hr",
        companyStage: "startup_0_3",
        company: "Temp Co",
        title: "临时岗",
        description: "岗位描述岗位描述岗位描述岗位描述岗位描述岗位描述",
        status: "open",
        reviewStatus: "approved",
      },
      select: { id: true },
    });

    await prisma.organization.delete({ where: { id: tmp.id } });

    const after = await prisma.jobPosting.findUnique({
      where: { id: posting.id },
      select: { id: true, orgId: true, company: true },
    });
    expect(after).not.toBeNull();
    expect(after!.orgId).toBeNull();
    expect(after!.company).toBe("Temp Co"); // 冗余的公司名留着，历史岗不至于变匿名
  });
});
