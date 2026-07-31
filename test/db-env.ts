// 测试库连接：默认本地 docker（5433），CI 可用 TEST_DATABASE_URL 覆盖为其 postgres service。
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://careeros:careeros_dev@localhost:5433/careeros_test?schema=careeros";

// 维护库 URL（用于 CREATE / DROP DATABASE，需连到非目标库）：把库名换成 postgres。
export function maintenanceUrl(): string {
  const u = new URL(TEST_DATABASE_URL);
  u.pathname = "/postgres";
  u.search = "";
  return u.toString();
}

export function testDbName(): string {
  return new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
}
