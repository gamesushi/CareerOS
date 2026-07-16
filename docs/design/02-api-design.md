# CareerOS API 设计（REST / OpenAPI 3.1）

约定：
- Base path `/api/v1`，JSON，鉴权 = Auth.js session cookie（浏览器）或 `Authorization: Bearer <PAT>`（未来开放 API）。
- 所有资源默认**行级隔离**：普通用户只能访问 `user_id = 当前用户` 的行；Admin 除外。
- 列表统一 `?page=&page_size=&sort=`，响应 `{ data, total, page, page_size }`。
- 错误统一 `{ error: { code, message, details? } }`；异步任务统一返回 `{ task_id, status }`，前端轮询或 SSE 订阅。

## 1. 端点总览

### Auth（Auth.js 托管）
```
GET/POST /api/auth/*            # signin / callback / signout / session（Auth.js 标准路由）
POST /api/v1/auth/register      # email + name，触发 magic link
GET  /api/v1/me                 # 当前用户 + career_profile 摘要
PUT  /api/v1/me                 # 更新基础信息 / locale / job_status / privacy
```

### Resume Import（异步管线）
```
POST /api/v1/imports/resume            # multipart 上传（pdf/docx/md/linkedin zip）→ {import_id}
GET  /api/v1/imports/:id               # 状态机 pending→parsing→extracting→review→applied/failed
GET  /api/v1/imports/:id/extracted     # LLM 抽取的候选实体（review 状态可用）
POST /api/v1/imports/:id/apply         # body=用户在确认页勾选/修改后的实体集 → 写入职业库
GET  /api/v1/imports                   # 导入历史
```

### Career Knowledge Base（实体 CRUD，全部同构）
```
GET/POST           /api/v1/experiences
GET/PUT/DELETE     /api/v1/experiences/:id
GET/POST           /api/v1/projects            # ?experience_id= 过滤
GET/PUT/DELETE     /api/v1/projects/:id
GET/POST           /api/v1/skills
GET/PUT/DELETE     /api/v1/skills/:id
GET/POST           /api/v1/skills/:id/evidences
DELETE             /api/v1/skills/:id/evidences/:evidenceId
GET/POST           /api/v1/achievements
GET/PUT/DELETE     /api/v1/achievements/:id
GET/POST           /api/v1/educations
GET/PUT/DELETE     /api/v1/educations/:id
```

### Career Profile & Graph
```
GET  /api/v1/career/profile
POST /api/v1/career/profile/regenerate   # 异步，AI 重算画像 → {task_id}
GET  /api/v1/career/graph                # 图谱节点+边（见 §3 Schema）
GET  /api/v1/career/timeline             # 按时间轴聚合（Dashboard 用）
```

### Work Log
```
GET/POST       /api/v1/worklogs          # ?from=&to=&tag=&project_id=&q=
GET/PUT/DELETE /api/v1/worklogs/:id
POST           /api/v1/worklogs/:id/summarize   # AI 摘要+技能/项目建议关联（异步）
```

### JD & Matching
```
POST /api/v1/jds/import        # {url} 或 {text} 或 multipart 文件 → 异步解析
GET  /api/v1/jds               # JD 库
GET  /api/v1/jds/:id
DELETE /api/v1/jds/:id
POST /api/v1/jds/:id/match     # 触发匹配（异步）→ {task_id}
GET  /api/v1/matches/:id       # 匹配结果（分数/缺口/证据）
```

### Resume（视图/快照）
```
POST /api/v1/resumes/generate  # {jd_id?, resume_type, template_id, lang} 异步 → {task_id, resume_id}
GET  /api/v1/resumes           # 历史版本列表
GET  /api/v1/resumes/:id
PUT  /api/v1/resumes/:id       # 微调快照 JSON / 换模板 / 改状态
DELETE /api/v1/resumes/:id
POST /api/v1/resumes/:id/export        # 渲染 PDF（异步）→ {task_id}
GET  /api/v1/resumes/:id/file          # 302 → 预签名下载 URL
```

### 检索（pgvector + WeKnora hybrid-search 聚合）
```
POST /api/v1/search   # { query, types?: ["experience","project","skill","work_log"], top_k? }
                      # 实体级走本地 embeddings，全文证据走 WeKnora KB，合并去重返回
```

### Tasks（异步任务通用查询）
```
GET /api/v1/tasks/:id          # {status, progress?, result_ref?, error?}
GET /api/v1/tasks/:id/events   # SSE 进度流（导入/生成页面用）
```

## 2. 状态机

```
resume_imports:  pending → parsing(docreader) → extracting(LLM) → review(等人工) → applied
                                     ↘ failed ↙
job_descriptions: pending → parsing → parsed / failed
resumes:         draft ⇄ final → archived
```

## 3. OpenAPI 3.1（核心 Schema，可直接生成 TS 类型）

```yaml
openapi: 3.1.0
info: { title: CareerOS API, version: 0.1.0 }
servers: [{ url: /api/v1 }]
components:
  securitySchemes:
    session: { type: apiKey, in: cookie, name: authjs.session-token }
  schemas:
    Experience:
      type: object
      required: [company, title, startDate]
      properties:
        id: { type: string, format: uuid, readOnly: true }
        company: { type: string, maxLength: 128 }
        title: { type: string, maxLength: 128 }
        employmentType: { type: string, enum: [fulltime, contract, intern, freelance] }
        startDate: { type: string, format: date }
        endDate: { type: [string, "null"], format: date }
        location: { type: string }
        description: { type: string, description: Markdown }
        highlights: { type: array, items: { type: string } }
        lang: { type: string, enum: [zh, en, ja] }
        source: { type: string, enum: [manual, import, ai], readOnly: true }
    Project:
      type: object
      required: [name]
      properties:
        id: { type: string, format: uuid, readOnly: true }
        experienceId: { type: [string, "null"], format: uuid }
        name: { type: string }
        role: { type: string }
        startDate: { type: [string, "null"], format: date }
        endDate: { type: [string, "null"], format: date }
        description: { type: string }
        outcome: { type: string }
        techStack: { type: array, items: { type: string } }
        links: { type: array, items: { type: object, properties: { label: {type: string}, url: {type: string, format: uri} } } }
        skillIds: { type: array, items: { type: string, format: uuid } }
    Skill:
      type: object
      required: [name]
      properties:
        id: { type: string, format: uuid, readOnly: true }
        name: { type: string, maxLength: 80 }
        category: { type: string, enum: [language, framework, tool, domain, soft] }
        level: { type: integer, minimum: 0, maximum: 100 }
        levelSource: { type: string, enum: [manual, ai], readOnly: true }
        lastUsedAt: { type: [string, "null"], format: date, readOnly: true }
        evidenceCount: { type: integer, readOnly: true }
    SkillEvidence:
      type: object
      required: [sourceType]
      properties:
        id: { type: string, format: uuid, readOnly: true }
        sourceType: { type: string, enum: [project, experience, work_log, achievement, certificate, external] }
        sourceId: { type: [string, "null"], format: uuid }
        note: { type: string }
        url: { type: [string, "null"], format: uri }
        weight: { type: integer, minimum: 1, maximum: 5, default: 1 }
    Achievement:
      type: object
      required: [title]
      properties:
        id: { type: string, format: uuid, readOnly: true }
        title: { type: string, maxLength: 200 }
        metricValue: { type: [number, "null"] }
        metricUnit: { type: [string, "null"] }
        metricText: { type: [string, "null"] }
        experienceId: { type: [string, "null"], format: uuid }
        projectId: { type: [string, "null"], format: uuid }
        occurredAt: { type: [string, "null"], format: date }
    WorkLog:
      type: object
      required: [logDate, title, content]
      properties:
        id: { type: string, format: uuid, readOnly: true }
        logDate: { type: string, format: date }
        title: { type: string, maxLength: 200 }
        content: { type: string, description: Markdown }
        tags: { type: array, items: { type: string } }
        aiSummary: { type: [string, "null"], readOnly: true }
        projectIds: { type: array, items: { type: string, format: uuid } }
        skillIds: { type: array, items: { type: string, format: uuid } }
        source: { type: string, enum: [manual, voice, email, notion, github], readOnly: true }
    CareerProfile:
      type: object
      properties:
        headline: { type: string }
        summary: { type: string }
        careerTags: { type: array, items: { type: string } }
        careerLevel: { type: string, enum: [junior, mid, senior, staff, exec] }
        yearsExperience: { type: number }
        industryTags: { type: array, items: { type: string } }
        isStale: { type: boolean, readOnly: true }
    JobDescription:
      type: object
      properties:
        id: { type: string, format: uuid, readOnly: true }
        company: { type: string }
        title: { type: string }
        sourceUrl: { type: [string, "null"], format: uri }
        status: { type: string, enum: [pending, parsing, parsed, failed], readOnly: true }
        parsed:
          type: [object, "null"]
          properties:
            skills:
              type: array
              items: { type: object, properties: { name: {type: string}, required: {type: boolean}, weight: {type: integer} } }
            experience:
              type: array
              items: { type: object, properties: { desc: {type: string}, yearsMin: {type: [integer, "null"]} } }
            industry: { type: array, items: { type: string } }
            keywords: { type: array, items: { type: string } }
            seniority: { type: [string, "null"] }
            location: { type: [string, "null"] }
    JobMatch:
      type: object
      properties:
        id: { type: string, format: uuid }
        jdId: { type: string, format: uuid }
        matchScore: { type: number, minimum: 0, maximum: 100 }
        skillCoverage: { type: number }
        experienceCoverage: { type: number }
        industryCoverage: { type: number }
        missingSkills:
          type: array
          items: { type: object, properties: { name: {type: string}, required: {type: boolean}, suggestion: {type: string} } }
        matchedEvidence:
          type: array
          items:
            type: object
            properties:
              jdItem: { type: string }
              entityType: { type: string }
              entityId: { type: string, format: uuid }
              similarity: { type: number }
        resumeId: { type: [string, "null"], format: uuid }
    Resume:
      type: object
      properties:
        id: { type: string, format: uuid, readOnly: true }
        title: { type: string }
        resumeType: { type: string, enum: [zh, en, ja_shokumu, linkedin, cover_letter] }
        version: { type: integer, readOnly: true }
        templateId: { type: string }
        resumeJson: { type: object, description: "JSON Resume Schema；日文扩展字段在 x-jis 键" }
        jdId: { type: [string, "null"], format: uuid }
        status: { type: string, enum: [draft, final, archived] }
        generatedAt: { type: string, format: date-time, readOnly: true }
    CareerGraph:
      type: object
      properties:
        nodes:
          type: array
          items:
            type: object
            properties:
              id: { type: string }
              type: { type: string, enum: [user, experience, project, skill, achievement] }
              label: { type: string }
              meta: { type: object }
        edges:
          type: array
          items:
            type: object
            properties:
              from: { type: string }
              to: { type: string }
              rel: { type: string, enum: [WORKED_AT, PARTICIPATED_IN, HAS_SKILL, HAS_ACHIEVEMENT, EVIDENCED_BY] }
    AsyncTask:
      type: object
      properties:
        taskId: { type: string }
        status: { type: string, enum: [queued, running, succeeded, failed] }
        progress: { type: [number, "null"] }
        resultRef: { type: [object, "null"] }
        error: { type: [string, "null"] }
    Error:
      type: object
      properties:
        error:
          type: object
          properties:
            code: { type: string }
            message: { type: string }
            details: { type: [object, "null"] }
security: [{ session: [] }]
paths:
  /imports/resume:
    post:
      summary: 上传简历文件启动导入管线
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              required: [file]
              properties:
                file: { type: string, format: binary }
                sourceHint: { type: string, enum: [generic, linkedin, ja_shokumu] }
      responses:
        "202":
          content: { application/json: { schema: { type: object, properties: { importId: {type: string}, taskId: {type: string} } } } }
  /imports/{id}/apply:
    post:
      summary: 确认页提交，把候选实体写入职业库
      parameters: [{ name: id, in: path, required: true, schema: { type: string } }]
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                experiences: { type: array, items: { $ref: "#/components/schemas/Experience" } }
                projects: { type: array, items: { $ref: "#/components/schemas/Project" } }
                skills: { type: array, items: { $ref: "#/components/schemas/Skill" } }
                achievements: { type: array, items: { $ref: "#/components/schemas/Achievement" } }
                educations: { type: array, items: { type: object } }
      responses: { "200": { description: 写入结果统计 } }
  /jds/{id}/match:
    post:
      summary: 触发 JD 匹配
      responses:
        "202": { content: { application/json: { schema: { $ref: "#/components/schemas/AsyncTask" } } } }
  /resumes/generate:
    post:
      summary: 从职业库生成简历快照
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [resumeType]
              properties:
                jdId: { type: [string, "null"], format: uuid }
                resumeType: { type: string, enum: [zh, en, ja_shokumu] }
                templateId: { type: string, default: openresume-classic }
                emphasis: { type: array, items: { type: string }, description: 用户希望突出的方向 }
      responses:
        "202": { content: { application/json: { schema: { $ref: "#/components/schemas/AsyncTask" } } } }
  # 其余 CRUD 端点为标准 REST 语义，Schema 复用上方定义，实现时由 zod-to-openapi 自动生成完整文档
```

## 4. 与 WeKnora 的服务间调用（内部）

| 场景 | WeKnora 端点 | 说明 |
|---|---|---|
| 建用户档案库 | `POST /api/v1/knowledge-bases` | 注册时惰性创建，存 `users.weknora_kb_id` |
| 简历/日志原文入库 | `POST /api/v1/knowledge-bases/:id/knowledge/file` / `manual` | 拿回 knowledge_id 存本地 |
| 解析进度 | `GET /api/v1/knowledge/:id/stages` | 导入管线轮询 parsing 完成 |
| 取解析文本 | `GET /api/v1/chunks/:knowledge_id` | 拼回全文给 LLM 抽取 |
| 证据/相似检索 | `POST /api/v1/knowledge-bases/:id/hybrid-search` | Skill Evidence Search、Similar Experience |

调用凭据：服务级 API Key（WeKnora 的 apiKey 机制），CareerOS 后端持有，前端永不直连 WeKnora。
