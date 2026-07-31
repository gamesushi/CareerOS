import { describe, it, expect, vi, beforeEach } from "vitest";

// 安全路径回归网：门禁分支用 mock prisma / auth 覆盖，无需真实 DB。
// 覆盖 isActiveAdmin（管理员判定）、requireUser（封禁/软删拦截）、requireAdmin（越权拦截）。

const findUnique = vi.fn();
vi.mock("@careeros/db", () => ({
  prisma: { user: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));

const authMock = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: (...a: unknown[]) => authMock(...a) }));

import { isActiveAdmin, requireUser, requireAdmin } from "../api";

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
