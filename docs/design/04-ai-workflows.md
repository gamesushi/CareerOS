# CareerOS AI 工作流设计

## 0. AI Gateway 模块

单一入口 `src/lib/ai/`，所有 LLM 调用必须经过它，不允许业务代码直连 SDK。

```
ai/
├─ gateway.ts        # run(task, input) → 路由到 provider + 模型；重试/超时/降级
├─ providers/        # openai.ts / gemini.ts / deepseek.ts（统一 ChatCompletion 接口）
├─ tasks/            # 每个能力一个文件：schema(zod) + prompt + 后处理
│   ├─ resumeParse.ts
│   ├─ jdParse.ts
│   ├─ resumeGenerate.ts
│   ├─ profileGenerate.ts
│   ├─ worklogSummarize.ts
│   └─ translate.ts
├─ embedding.ts      # embed(texts[]) → 写 embeddings 表（content_hash 去重）
└─ audit.ts          # 每次调用落 ai_runs（model/tokens/cost/latency/prompt_version）
```

**约定**：
- 结构化输出一律 zod schema + JSON mode/structured output，解析失败自动重试 1 次（附错误信息），再失败标 task failed，绝不落半截数据。
- 模型路由配置化（env/config 表）：抽取类默认 DeepSeek（便宜、中文强），生成类默认 GPT/Gemini 旗舰，翻译/日文文体用 Gemini。可按 task 覆写。
- 每个 task 的 prompt 带 `PROMPT_VERSION` 常量，写入 ai_runs，回归可追溯。
- 所有任务在 BullMQ 队列 `ai` 中执行，HTTP 层只入队。

## 1. Resume Import 管线

```mermaid
flowchart LR
    A[文件上传 MinIO] --> B[job: parse]
    B --> C[WeKnora docreader\nPDF/DOCX/图片OCR → Markdown]
    C --> D[原文入 WeKnora KB\nchunk+embed 供日后证据检索]
    C --> E[job: extract\nresumeParse task]
    E --> F{zod 校验}
    F -- 失败 --> E2[重试1次] --> F
    F -- 通过 --> G[置信度标注 + 与库内实体查重\nname_norm + embedding 相似度]
    G --> H[status=review\n通知用户进确认页]
    H --> I[用户确认 apply]
    I --> J[(写入实体表 + source=import)]
    J --> K[job: embed 新实体]
    J --> L[career_profiles.is_stale = true]
```

**resumeParse 输出契约**（zod 摘要）：
```ts
{
  basics: { name?, email?, phone?, location?, links?: string[] },
  experiences: [{ company, title, startDate, endDate?, location?, description?,
                  highlights: string[], confidence: 'high'|'mid'|'low' }],
  projects:   [{ name, role?, startDate?, endDate?, description?, outcome?,
                 techStack: string[], belongsToCompany?, confidence }],
  skills:     [{ name, category?, evidenceHint? }],   // evidenceHint: 原文出处片段
  achievements: [{ title, metricValue?, metricUnit?, metricText?, context? }],
  educations: [{ school, degree?, major?, startDate?, endDate? }]
}
```
提示词要点：只抽取原文明确存在的信息，禁止推断补全；日期缺月份补 `-01` 并降置信度；`sourceHint=ja_shokumu` 时启用日文简历专用 few-shot（職務要約/自己PR 段落归入 basics.summary 与 achievements）。

## 2. JD Matching 管线

```mermaid
flowchart LR
    A[JD 输入: 文件/URL/文本] --> B{来源}
    B -- 文件 --> C[docreader 解析]
    B -- URL --> D[抓取正文]
    B -- 文本 --> E[直用]
    C & D & E --> F[jdParse task\n→ parsed JSONB]
    F --> G[job: match]
    G --> G1[技能匹配\nname_norm 精确+别名 → 失败再向量≥0.85]
    G --> G2[经历匹配\nJD要求条目 embedding × experiences/projects top-1]
    G --> G3[行业匹配\nparsed.industry × profile.industry_tags]
    G1 & G2 & G3 --> H[加权打分\n0.5/0.3/0.2 → job_matches]
    H --> I[缺失技能 + AI 建议\n'你有相近技能X，可补证据']
```

匹配本身**不调 LLM**（纯 SQL + 向量，快且免费），只有"缺口建议"一步用小模型生成文案。

## 3. Resume Generate 管线

```mermaid
flowchart TD
    A[POST /resumes/generate] --> B{带 jd_id?}
    B -- 是 --> C[取 job_matches.matched_evidence\n按相关度筛实体 top-N]
    B -- 否 --> D[取全部实体，按时间+成果权重排序]
    C & D --> E[组装事实包 FactPack\n实体原文，不允许 LLM 之外的信息]
    E --> F[resumeGenerate task\n选材+措辞+bullet化, 输出 JSON Resume]
    F --> G{目标语言 ≠ 实体语言?}
    G -- 是 --> H[translate task\n日文走職務経歴書文体重写, 填 x-jis 段]
    G -- 否 --> I
    H --> I[zod 校验 JSON Resume Schema]
    I --> J[(resumes 快照 status=draft)]
    J --> K[前端 OpenResume 组件实时预览]
    K --> L[export: react-pdf 服务端渲染 → MinIO → 预签名URL]
```

**防幻觉硬约束**：prompt 中声明"只能使用 FactPack 中的事实，可以改写措辞、不可新增数字/公司/职位"；生成后跑一个校验步——对 resume_json 里出现的所有数字与专有名词做 FactPack 包含性检查，未命中的字段标 `x-warnings`，编辑器里黄色高亮提醒。

## 4. 其他任务

| Task | 触发 | 输入 → 输出 |
|---|---|---|
| profileGenerate | 实体变更后用户点"重新生成画像" | 全部实体摘要 → headline/summary/career_tags/level/years/industry_tags |
| worklogSummarize | 日志保存后自动 | 日志内容 → 1-2 句摘要 + 建议技能(对齐已有 skills 词表)+建议项目关联 |
| translate | 简历生成子步骤 | JSON Resume + 目标语言/文体 → 本地化 JSON |

## 5. 失败与成本护栏

- 队列级：`ai` 队列并发 2，任务超时 120s，指数退避重试 2 次后落 failed，前端 TaskProgress 显示可读错误。
- 成本：ai_runs 聚合出每用户每日 cost_usd，超过阈值（env `AI_DAILY_BUDGET_USD`）拒绝新生成类任务（抽取类不限，导入是核心路径）。
- 降级链：主模型 5xx → 同能力备选 provider（配置里声明 fallback 顺序）。
