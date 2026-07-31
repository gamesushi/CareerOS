import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// 集成测试：覆盖多地区简历生成所依赖的确定性契约层
// （shared 归一化/JD 打分契约/简历 schema + web 的个人信息注入）。
// 不含需要 Postgres/pgvector/embedding 的 jobMatch 编排层——那属于端到端范畴，另行搭建。
export default defineConfig({
  test: {
    environment: "node",
    include: ["apps/web/src/**/*.test.ts", "packages/shared/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/*.db.test.ts"], // DB 层由 vitest.db.config.ts 单独跑
    globals: false,
  },
  resolve: {
    alias: {
      // 让测试文件能从包名导入类型/契约；merge-personal 里的 @careeros/db 为 `import type`，编译期已擦除，无需别名。
      "@careeros/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
    },
  },
});
