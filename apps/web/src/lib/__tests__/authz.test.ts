import { describe, it, expect, vi, beforeEach } from "vitest";

// 安全路径回归网：门禁分支用 mock prisma / auth 覆盖，无需真实 DB。
// 覆盖 isActiveAdmin（管理员判定）、requireUser（封禁/软删拦截）、requireAdmin（越权拦截）。

const findUnique = vi.fn();
vi.mock("@careeros/db", () => ({
  prisma: { user: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));

// requireUser 走的是容错版 getSession（auth() 在 AUTH_SECRET 轮换后会抛，getSession 降级为无会话）。
// 两个导出都指向同一个 mock，避免哪天 api.ts 换回 auth() 时测试静默失效。
const authMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: (...a: unknown[]) => authMock(...a),
  getSession: (...a: unknown[]) => authMock(...a),
}));

import { isActiveAdmin, requireUser, requireAdmin, requireRole } from "../api";

const EMPLOYER = ["recruiter", "enterprise", "admin"] as const;

beforeEach(() => {
  findUnique.mockReset();
  authMock.mockReset();
});

describe("isActiveAdmin", () => {
  it("admin 且未软删 → true", async () => {
    findUnique.mockResolvedValue({ role: "admin", deletedAt: null });
    expect(await isActiveAdmin("u1")).toBe(true);
  });
  it("普通用户 → false", async () => {
    findUnique.mockResolvedValue({ role: "user", deletedAt: null });
    expect(await isActiveAdmin("u1")).toBe(false);
  });
  it("admin 但已软删 → false（降权/删号即时失效）", async () => {
    findUnique.mockResolvedValue({ role: "admin", deletedAt: new Date() });
    expect(await isActiveAdmin("u1")).toBe(false);
  });
  it("用户不存在 → false", async () => {
    findUnique.mockResolvedValue(null);
    expect(await isActiveAdmin("u1")).toBe(false);
  });
});

describe("requireUser 门禁", () => {
  it("未登录 → 401", async () => {
    authMock.mockResolvedValue(null);
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
  it("被封禁 → 403 banned（即时拒绝）", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "user" } });
    findUnique.mockResolvedValue({ id: "u1", deletedAt: null, bannedAt: new Date() });
    await expect(requireUser()).rejects.toMatchObject({ status: 403, code: "banned" });
  });
  it("已软删 → 401", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "user" } });
    findUnique.mockResolvedValue({ id: "u1", deletedAt: new Date(), bannedAt: null });
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
  it("正常用户 → 返回 userId + role", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "user" } });
    findUnique.mockResolvedValue({ id: "u1", deletedAt: null, bannedAt: null });
    expect(await requireUser()).toEqual({ userId: "u1", role: "user" });
  });
});

describe("requireAdmin 门禁", () => {
  it("非管理员 → 403 forbidden", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "user" } });
    findUnique
      .mockResolvedValueOnce({ id: "u1", deletedAt: null, bannedAt: null }) // requireUser
      .mockResolvedValueOnce({ role: "user", deletedAt: null }); // isActiveAdmin
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });
  it("管理员 → 通过，返回 userId", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    findUnique
      .mockResolvedValueOnce({ id: "u1", deletedAt: null, bannedAt: null })
      .mockResolvedValueOnce({ role: "admin", deletedAt: null });
    expect(await requireAdmin()).toEqual({ userId: "u1" });
  });
});

// B 端发岗门禁。核心不变量：角色以 DB 为准，JWT 里的 session.role 只是登录快照——
// 用户在设置页自助切成 recruiter 后不重新登录也必须立刻放行，反之降权也必须立刻拒绝。
describe("requireRole 门禁", () => {
  it("DB 是 recruiter（JWT 还是旧的 user）→ 放行", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "user" } }); // 过期的 JWT 快照
    findUnique
      .mockResolvedValueOnce({ id: "u1", deletedAt: null, bannedAt: null }) // requireUser
      .mockResolvedValueOnce({ role: "recruiter", deletedAt: null }); // requireRole 查 DB
    expect(await requireRole(EMPLOYER)).toEqual({ userId: "u1", role: "recruiter" });
  });

  it("DB 已降回 user（JWT 还写着 recruiter）→ 403", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "recruiter" } });
    findUnique
      .mockResolvedValueOnce({ id: "u1", deletedAt: null, bannedAt: null })
      .mockResolvedValueOnce({ role: "user", deletedAt: null });
    await expect(requireRole(EMPLOYER)).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });

  it("admin 也算可发岗角色 → 放行", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    findUnique
      .mockResolvedValueOnce({ id: "u1", deletedAt: null, bannedAt: null })
      .mockResolvedValueOnce({ role: "admin", deletedAt: null });
    expect(await requireRole(EMPLOYER)).toEqual({ userId: "u1", role: "admin" });
  });

  it("角色命中但已软删 → 403（删号即时失效）", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "recruiter" } });
    findUnique
      .mockResolvedValueOnce({ id: "u1", deletedAt: null, bannedAt: null })
      .mockResolvedValueOnce({ role: "recruiter", deletedAt: new Date() });
    await expect(requireRole(EMPLOYER)).rejects.toMatchObject({ status: 403 });
  });

  it("未登录 → 401（在角色判定之前就被 requireUser 挡下）", async () => {
    authMock.mockResolvedValue(null);
    await expect(requireRole(EMPLOYER)).rejects.toMatchObject({ status: 401 });
  });

  it("自定义 message 透传到 403 响应", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "user" } });
    findUnique
      .mockResolvedValueOnce({ id: "u1", deletedAt: null, bannedAt: null })
      .mockResolvedValueOnce({ role: "user", deletedAt: null });
    await expect(requireRole(EMPLOYER, "需要招聘者权限")).rejects.toMatchObject({
      status: 403,
      message: "需要招聘者权限",
    });
  });
});
