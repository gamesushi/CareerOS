import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// DB 集成测试层（*.db.test.ts）：连真实 Postgres，验证行级隔离等无法用 mock 覆盖的行为。
// 与快速单元套件（vitest.config.ts）分开，独立运行：pnpm test:db。
export default defineConfig({
  test: {
    environment: "node",
    include: ["apps/**/*.db.test.ts", "packages/**/*.db.test.ts"],
    globalSetup: ["./test/db-global-setup.ts"],
    setupFiles: ["./test/db-setup.ts"],
    fileParallelism: false, // 串行跑，避免共享库互相干扰
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@careeros/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
    },
  },
});
