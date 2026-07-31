# CareerOS 测试说明书（面向 AI / 新协作者）

> 版本：v1.0 ｜ 日期：2026-07-29
> 目的：让任何 AI 或新成员**无需口头交接**即可运行、理解、扩展本仓库的自动化测试。
> 适用范围：静态检查（typecheck / lint）+ vitest 集成测试。DB 端到端层尚未搭建（见 §6）。

---

## 0. TL;DR（最短路径）

```bash
# 在仓库根目录 /Users/hebeihang/DEV/tools/careeros 执行
pnpm install                              # 若依赖未装
pnpm --filter @careeros/db generate       # 生成 Prisma Client（typecheck 前置，只需首次/schema 变更后）
pnpm test                                 # 跑 vitest 集成测试（当前 33 用例，应全绿）
pnpm -r typecheck                         # 全包类型检查
pnpm --filter web lint                    # web ESLint
```

判定标准：`pnpm test` 输出 `Test Files N passed`、`Tests M passed`，无 `failed`；typecheck / lint 退出码 0。

---

## 1. 环境与前置

| 项 | 要求 | 说明 |
|---|---|---|
| 包管理器 | **pnpm**（`packageManager` 锁定 `pnpm@11.13.1`） | 勿用 npm/yarn，workspace 依赖靠 pnpm 软链 |
| Node | ≥ 22（见根 `package.json` engines） | — |
| Prisma Client | typecheck 前需 `pnpm --filter @careeros/db generate` | 未生成会导致 `@careeros/db` 类型缺失、typecheck 误报；**vitest 本身不需要**（测试不触 DB） |
| 数据库 | **当前测试不需要** | jobMatch / API 路由的 DB 测试尚未纳入，见 §6 |
| 网络 | 仅首次装依赖需要 | 测试离线可跑 |

> 关键点：**vitest 集成测试零外部依赖**（不连 Postgres、不调 embedding、不起 dev server），因此可在任意环境稳定跑绿。

---

## 2. 运行命令速查

| 目的 | 命令 |
|---|---|
| 跑全部集成测试（单次） | `pnpm test` |
| 监听模式（改文件自动重跑） | `pnpm test:watch` |
| 只跑某文件 | `pnpm test -- merge-personal` （vitest 按路径子串过滤） |
| 只跑某用例 | `pnpm test -- -t "x-jis"` （按 test 名过滤） |
| 全包类型检查 | `pnpm -r typecheck` |
| web ESLint | `pnpm --filter web lint` |

> `pnpm test` = `vitest run`（见根 `package.json` scripts）。`--` 后的参数原样透传给 vitest。

---

## 3. 测试架构

### 3.1 配置
- **`vitest.config.ts`（仓库根）**：`environment: node`；`include` 只扫 `apps/web/src/**/*.test.ts` 与 `packages/shared/src/**/*.test.ts`；`globals: false`。
- **别名**：`@careeros/shared` → `packages/shared/src/index.ts`，`@` → `apps/web/src`。
  - `merge-personal.ts` 里的 `@careeros/db` 是 `import type`，编译期擦除，**无需别名**，也因此测试不会拉起 Prisma。

### 3.2 测试文件位置（约定）
测试**与被测代码同包**，放在最近的 `__tests__/` 目录，命名 `*.test.ts`：

```
apps/web/src/lib/__tests__/merge-personal.test.ts     # web 侧 lib
packages/shared/src/__tests__/normalize.test.ts       # 共享包
packages/shared/src/__tests__/jd-contract.test.ts
packages/shared/src/__tests__/resume-schema.test.ts
```

### 3.3 编码约定
- **显式导入**：`import { describe, it, expect } from "vitest";`（`globals:false`，不依赖全局）。
- **零 mock**：测真实模块组合。这是「集成测试」的定位——被测对象是纯/半纯的确定性逻辑，无需打桩。
- **shared 内部**用相对路径导入（`../normalize`）；**跨包**类型用包名（`import type { JsonResume } from "@careeros/shared"`）。
- 表格化用例优先用 `it.each([...])`。

---

## 4. 当前覆盖范围（33 用例 / 4 文件）

测试聚焦**多地区简历生成所依赖的确定性契约层**：归一化 → JD 打分契约 → 简历 schema → 个人信息注入。这层的默认值/不变量一旦漂移，匹配分数或简历字段会**静默错位**，故用测试锁死。

| 文件 | 覆盖点 | 关键断言示例 |
|---|---|---|
| `merge-personal.test.ts` | 共享个人档案注入简历 | 档案覆盖简历残留值；`location` 优先级 preferredCity>region>原值；JP `x-jis` 注入 ふりがな/生年月日/住所/照片；无 jis 字段时不产 `x-jis` |
| `normalize.test.ts` | 技能/公司归一（查重+匹配基元） | `JS→javascript`、`K8s→kubernetes`；去公司后缀（有限公司/Inc./株式会社）；异写归一后一致 |
| `jd-contract.test.ts` | JD 解析契约 + 打分常量 | `required` 默认 true、`weight` 默认 3；非法 weight 被拒；**`MATCH_WEIGHTS` 之和=1**；`EXP_SIM_ZERO<EXP_SIM_FULL` |
| `resume-schema.test.ts` | 简历输出 schema | 履歴書 `x-jis` 全字段合法；`ikaseruKeiken/menkyoShikaku` 默认 []；**ResumeType 四类型 zh/en/ja_shokumu/ja_rirekisho** 均被接受 |

被测源码位置：
- `apps/web/src/lib/merge-personal.ts`
- `packages/shared/src/normalize.ts`
- `packages/shared/src/jd.ts`
- `packages/shared/src/resume.ts`

---

## 5. 如何新增一个测试（给 AI 的步骤）

1. **定位被测对象**：确认它是**确定性、无外部 I/O**的（纯函数、zod schema、常量）。有 DB/网络副作用的走 §6，勿塞进本层。
2. **建文件**：在被测代码最近的 `__tests__/` 下建 `<模块名>.test.ts`。
3. **写用例**：
   ```ts
   import { describe, it, expect } from "vitest";
   import { 目标 } from "../目标模块";

   describe("目标 · 场景", () => {
     it("应当……", () => {
       expect(目标(输入)).toBe(期望);
     });
   });
   ```
4. **确认被 include 命中**：文件须在 `apps/web/src/**` 或 `packages/shared/src/**` 下且以 `.test.ts` 结尾。若要测其他包（如 `apps/worker` 纯函数），先在 `vitest.config.ts` 的 `include` 里补路径。
5. **跑**：`pnpm test -- <文件名子串>`，绿了再 `pnpm test` 全量。
6. **别破坏静态检查**：测试文件在 `src/**` 内，会被 `tsc` 和 eslint 扫描，需同时通过 `pnpm -r typecheck` 与 `pnpm --filter web lint`。

**避坑**：
- 不要 import 会拉起 Prisma 的模块（如 `@careeros/db` 的运行时导出、`apps/worker/src/jobs/*` 编排函数），否则测试需要 DB 才能跑。只 `import type` 是安全的（编译期擦除）。
- 浮点相等用 `toBeCloseTo`，勿用 `toBe`。

---

## 6. 尚未覆盖 + 未来 DB 端到端层

当前**刻意不含**以下两类，因为它们无法在无基础设施时稳定跑绿：

1. **`jobMatch` 打分全链路**（`apps/worker/src/jobs/jobMatch.ts` 的 `handleJobMatchJob`）：依赖 Postgres + pgvector + embedding provider。本层只测了它依赖的**纯基元**（`normalizeSkill`、`MATCH_WEIGHTS`、阈值、`jdParsed`）。
2. **API 路由行级隔离**（`requireUser`）：需真实 Prisma + 数据库。且多地区计划里的 `/api/v1/region-profile` 路由**尚未实现**，无对象可测。

**要补 DB 层时的建议方案**（未落地，供后续 AI 参考）：
- 用 **testcontainers** 起临时 Postgres，或本地 test schema；
- 每用例包在事务里跑完 `ROLLBACK`，保证隔离与可重复；
- 覆盖：`handleJobMatchJob` 的三路打分与权重重归一化、跨用户读写返回 401/空（行级隔离）、`mergePersonalIntoResume` → `resumeGenerate` 的落库形状。
- 这类测试建议独立 `include`（如 `*.db.test.ts`）并在 CI 里与无依赖层分开跑，避免本地默认 `pnpm test` 被 DB 拖慢/阻塞。

---

## 7. 故障排查

| 症状 | 原因 | 处理 |
|---|---|---|
| typecheck 报 `@careeros/db` 类型缺失 | 未生成 Prisma Client | `pnpm --filter @careeros/db generate` |
| 测试报找不到 `@careeros/shared` | 别名未生效/在非根目录跑 | 在**仓库根**跑 `pnpm test`；检查 `vitest.config.ts` 别名 |
| 新测试没被执行 | 不在 `include` 路径或未以 `.test.ts` 结尾 | 移到 `apps/web/src` 或 `packages/shared/src` 下，或补 `include` |
| 测试要连数据库才过 | 误引了带 Prisma 副作用的模块 | 改为 `import type`，或将其归入 §6 的 DB 层 |
| 浮点断言偶发失败 | 用了 `toBe` 比较浮点 | 改 `toBeCloseTo(期望, 位数)` |

---

_附录：本说明书对应的测试与配置由 2026-07-29 落地并验证（`pnpm test` → 33 passed；`pnpm -r typecheck` / `pnpm --filter web lint` 均 0 错）。新增被测能力后请同步更新 §4 覆盖表。_
