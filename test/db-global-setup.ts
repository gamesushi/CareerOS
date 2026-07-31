import { execSync } from "node:child_process";
import { TEST_DATABASE_URL, maintenanceUrl, testDbName } from "./db-env";

// vitest globalSetup：跑一次。建全新测试库 → migrate deploy 全部迁移；teardown 时删库。
export default async function setup() {
  const maint = maintenanceUrl();
  const name = testDbName();
  const dbExec = (sql: string) =>
    execSync(`pnpm --filter @careeros/db exec prisma db execute --url "${maint}" --stdin`, {
      input: sql,
      stdio: ["pipe", "ignore", "inherit"],
    });

  // 全新库（先删残留）
  dbExec(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE);`);
  dbExec(`CREATE DATABASE "${name}";`);

  // 应用全部迁移到测试库
  execSync(`pnpm --filter @careeros/db exec prisma migrate deploy`, {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: ["ignore", "ignore", "inherit"],
  });

  return async function teardown() {
    dbExec(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE);`);
  };
}
