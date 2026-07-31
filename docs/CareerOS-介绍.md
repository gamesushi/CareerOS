# CareerOS · 职业操作系统

> **一句话定位**：CareerOS 把"简历"从一份静态文档，还原成一座可持续生长、带证据、可检索的**职业数据库**——AI 在库上生成任意"视图"（简历 / 匹配报告 / 求职信），而你始终是数据的所有者。
>
> 项目原话：**"简历只是职业数据库的视图。"**

---

## 1. 它解决什么问题

传统简历工具本质是"文档编辑器"：你维护 N 份格式不同的 docx / pdf，每次投递手动改措辞。CareerOS 反过来思考——

1. **先建库，再生成视图**：用一次结构化的职业录入，喂给 AI 多次复用。简历、匹配报告、求职信都是同一份事实的不同投影。
2. **每条技能/经历都要有"证据"(Evidence)**：AI 不可凭空编造，必须有出处原文片段支撑。
3. **维护飞轮**：写工作日志 → 自动沉淀技能证据 → 匹配分提升 → 更愿意回来维护数据。这是产品的留存实验本体，埋点从第一天就做。

---

## 2. 关键能力

| 模块 | 能力 |
|---|---|
| **职业知识库** | 经历 / 项目 / 成果 / 教育 / 技能 全套 CRUD，横向时间轴，关系图谱（react-flow 只读视图），技能成长曲线 |
| **AI 简历导入** | 上传 PDF / DOCX / 图片 → WeKnora 文档解析 + OCR → LLM 抽取结构化 JSON（带置信度）→ 人工确认页（SplitView）核对修正后入库；含中/英/日三语回归集 |
| **AI 简历生成（防幻觉）** | FactPack 事实包机制：只能改写措辞，**不可**新增数字 / 公司 / 职位；生成后跑事实包含性校验，未命中项黄色高亮警告；多模板（classic / compact / ATS / 日文職務経歴書） |
| **JD 匹配** | JD 支持文本 / 文件 / URL 三种输入 → 解析 → 三路加权打分（技能 0.5 / 经历 0.3 / 行业 0.2）；匹配**不调 LLM**（纯 SQL + 向量，快且免费），仅"缺口建议"用小模型生成文案 |
| **岗位监测** | 已接入 **50+ 招聘源**：腾讯 / 字节 / Green / RemoteOK / HackerNews / Wantedly / 猎聘（Playwright）；网易游戏等 13+ 家 Greenhouse 板游戏公司；23+ 家金融机构（银行 / 保险 / 基金量化）。品类匹配（游戏 / 金融 / 技术 / 通用），可按角色 / 地区 / 语言 / 经验过滤 |
| **多语言** | 界面 **11 种语言**（zh-CN / zh-TW / en / ja / ko / de / fr / es / it / pt / ru）；简历文体支持中文 / 英文 / 日文職務経歴書（x-jis 段） |
| **PDF 导出** | react-pdf 服务端渲染，CJK 字体（NotoSansSC / NotoSansJP）正确渲染中/日文；ATS 模板对 applicant tracking system 友好 |
| **工作日志飞轮** | 日志保存后自动摘要（worklogSummarize），并建议关联的技能与项目，持续为匹配积累证据 |
| **隐私与权限** | 五角色 RBAC 矩阵（MVP 已实现 User / Admin），隐私开关行级规则，多用户数据严格隔离 |

---

## 3. 三条 AI 工作流（核心设计）

所有 LLM 调用统一经过 **AI Gateway**（`src/lib/ai/`），业务代码不允许直连 SDK；每次调用落 `ai_runs` 表（模型 / token / 成本 / 延迟可审计），并有每日预算护栏与 provider 降级链。

```
① 简历导入  文件→MinIO→WeKnora解析→resumeParse(置信度+查重)→人工确认→入库+embed
② JD 匹配   JD→解析→三路打分(技能/经历/行业)→缺口建议(小模型)
③ 简历生成  取实体/按JD筛→FactPack事实包→resumeGenerate→(翻译)→zod校验→PDF导出
```

**防幻觉硬约束**：生成 prompt 声明"只能使用 FactPack 中的事实"；生成后对简历里出现的**所有数字与专有名词**做 FactPack 包含性检查，未命中的字段标 `x-warnings`，编辑器内黄色高亮提醒。

---

## 4. 技术架构

**Monorepo（pnpm workspace）**

```
apps/web        Next.js 16（App Router）+ React 19 + Tailwind 4 + shadcn/ui
                next-auth v5 / @react-pdf/renderer / @xyflow/react（图谱）
apps/worker     BullMQ worker：AI 异步任务（解析 / 匹配 / 生成 / 监测轮询）
packages/db     Prisma schema + client（PostgreSQL + pgvector，18 表）
packages/shared zod 实体契约 + 归一化规则（前后端单一来源）
```

**关键技术决策（ADR）**
- **集成而非改造**：文档解析 / 证据检索交给独立服务 **WeKnora**，仅通过 REST API 调用，不 fork、不共库（docker compose 独立启动）。
- **向量方案**：PostgreSQL + pgvector，实体创建/更新钩子自动写 embedding（`content_hash` 去重），存量回填有批任务。
- **简历渲染**：受 Reactive Resume 启发做多模板，服务端 react-pdf 渲染，字体子集化支持 CJK。
- **AI Gateway**：provider 路由配置化（抽取类默认 DeepSeek，生成类默认 GPT/Gemini 旗舰，日文文体走 Gemini），每个 task 带 `PROMPT_VERSION` 可追溯。

**基础设施**：`docker-compose` 一键拉起 `postgres(pgvector):5433` + `redis:6380` + `minio:9100`。

---

## 5. 当前进展

- ✅ **MVP 闭环已实现**：上传简历 → 解析确认 → 职业库 CRUD → 上传 JD → 匹配 → 生成简历 → 导出 PDF，新用户 15 分钟内可走完且无需工程师介入。
- ✅ **显著扩展**：岗位监测 50+ 真实来源（含 Greenhouse 一行接入工厂、中文 SPA 用 Playwright headless 真实抓取）、11 语言界面、日文職務経歴書模板、ATS CJK 模板、职业图谱、工作日志飞轮。
- ✅ **工程纪律**：Playwright headless 冒烟测试验证来源真实可用；PyMuPDF 文本提取校验 CJK 字体正确渲染；prompt 变更跑三语回归集。
- 🔜 **路线图**（已记录优先级，未排期）：简历版本对比 / 更多模板、GitHub commits → 日志草稿、Recruiter 侧人才搜索、推荐信 / 求职信 / 面试问答生成（复用 FactPack，边际成本低）。

---

## 6. 本地运行

```bash
docker compose up -d              # postgres(pgvector):5433 / redis:6380 / minio:9100
cp .env.example .env              # 已含本地默认值
pnpm install
pnpm db:migrate                  # prisma migrate dev
pnpm --filter @careeros/db db:indexes   # trgm/HNSW 等 raw 索引
pnpm dev                         # web → http://localhost:3000
pnpm dev:worker                  # 可选，跑 AI 异步任务
```

> 开发模式登录：任意邮箱直登（`AUTH_DEV_CREDENTIALS=true`）。
> WeKnora 在 `../WeKnora` 用官方 compose 独立启动，CareerOS 只通过 REST API 调用。

---

## 7. 适合谁 / 不适合谁

- **适合**：想把职业资产"一次录入、到处复用"的人；需要中英日多语言简历的技术 / 游戏 / 金融从业者；希望用数据（而非感觉）判断"我还差什么技能"的求职者。
- **不适合**：只想要一个"填表即出 PDF"的极简工具的人——CareerOS 的价值在于**长期维护职业数据库**，前期录入成本更高，但复利在后续每次生成与匹配。
