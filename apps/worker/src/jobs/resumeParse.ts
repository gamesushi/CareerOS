import { prisma, Prisma } from "@careeros/db";
import {
  normalizeCompany,
  normalizeSkill,
  normalizeExtractedDate,
  SECTION_KINDS,
  toNewItems,
  toExistingItems,
  buildCandidatePairsForKind,
  type ExtractionResult,
  type ExtractedPayload,
  type DupHit,
  type SectionKind,
  type MergeItem,
} from "@careeros/shared";
import { getObjectBuffer } from "../lib/s3";
import { extractDocumentText } from "../lib/extractText";
import { runResumeParse, PROMPT_VERSION } from "../ai/tasks/resumeParse";
import { judgeDuplicate } from "../ai/tasks/judgeDuplicate";
import { startRun, finishRun } from "../ai/audit";

// 导入管线：pending → parsing(docreader) → extracting(LLM) → review / failed
// 状态即进度，前端 SSE 轮询 resume_imports.status（docs/design/02 §2 状态机）。

export async function handleResumeParseJob(importId: string): Promise<void> {
  const imp = await prisma.resumeImport.findUnique({ where: { id: importId } });
  if (!imp) throw new Error(`导入记录不存在: ${importId}`);
  if (imp.status === "applied") return; // 幂等：已入库的不重跑

  try {
    // 1. 文档解析
    await prisma.resumeImport.update({ where: { id: importId }, data: { status: "parsing", error: null } });
    const file = await getObjectBuffer(imp.fileKey);
    // 纯文本 / Markdown 直接解码；PDF/Word 等先 docreader，失败或抽空时自动回退本地 OCR。
    const markdown = await extractDocumentText(file, imp.fileName);
    await prisma.resumeImport.update({
      where: { id: importId },
      data: { rawText: markdown, status: "extracting" },
    });

    // 2. LLM 结构化抽取（含审计）
    const run = await startRun({
      userId: imp.userId,
      kind: "resume_parse",
      inputRef: { importId },
      promptVersion: PROMPT_VERSION,
    });
    const t0 = Date.now();
    let result: ExtractionResult;
    let model: string;
    try {
      const out = await runResumeParse(markdown);
      result = postProcess(out.result);
      model = out.model;
      await finishRun(run.id, {
        ok: true,
        model: out.model,
        tokensIn: out.tokensIn,
        tokensOut: out.tokensOut,
        latencyMs: Date.now() - t0,
      });
    } catch (e) {
      await finishRun(run.id, { ok: false, error: String(e), latencyMs: Date.now() - t0 });
      throw e;
    }

    // 3. 与库内实体查重，进入人工确认
    const duplicates = await findDuplicates(imp.userId, result);
    const payload: ExtractedPayload = { result, duplicates, promptVersion: PROMPT_VERSION, model };
    await prisma.resumeImport.update({
      where: { id: importId },
      data: { extracted: payload as unknown as Prisma.InputJsonValue, status: "review" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.resumeImport.update({
      where: { id: importId },
      data: { status: "failed", error: message },
    });
    throw e; // 让 BullMQ 记录失败（不重试：入库前的失败都可由用户重新上传触发）
  }
}

/** 日期补全（缺月/日补 01），被补全的记录降一档置信度 */
function postProcess(result: ExtractionResult): ExtractionResult {
  const downgrade = (c: "high" | "mid" | "low") => (c === "high" ? "mid" : "low");

  return {
    ...result,
    experiences: result.experiences.map((e) => {
      const start = normalizeExtractedDate(e.startDate);
      const end = normalizeExtractedDate(e.endDate);
      return {
        ...e,
        startDate: start.date,
        startDatePrecision: start.precision,
        endDate: end.date,
        endDatePrecision: end.precision,
        confidence: start.padded || end.padded ? downgrade(e.confidence) : e.confidence,
      };
    }),
    projects: result.projects.map((p) => {
      const start = normalizeExtractedDate(p.startDate);
      const end = normalizeExtractedDate(p.endDate);
      return {
        ...p,
        startDate: start.date,
        startDatePrecision: start.precision,
        endDate: end.date,
        endDatePrecision: end.precision,
        confidence: start.padded || end.padded ? downgrade(p.confidence) : p.confidence,
      };
    }),
    educations: result.educations.map((e) => {
      const start = normalizeExtractedDate(e.startDate);
      const end = normalizeExtractedDate(e.endDate);
      return {
        ...e,
        startDate: start.date,
        startDatePrecision: start.precision,
        endDate: end.date,
        endDatePrecision: end.precision,
      };
    }),
    honors: result.honors.map((e) => {
      const d = normalizeExtractedDate(e.date);
      return { ...e, date: d.date };
    }),
  };
}

async function findDuplicates(userId: string, result: ExtractionResult) {
  // 各分栏查重命中，按 section 归类
  const duplicates: Record<SectionKind, DupHit[]> = {
    work: [], project: [], achievement: [], education: [], honor: [],
  };
  const skills: { index: number; existingId: string; existingLabel: string }[] = [];

  // 每类分栏在 ExtractionResult 中的数组字段名
  const PLURAL: Record<SectionKind, keyof ExtractionResult> = {
    work: "experiences",
    project: "projects",
    achievement: "achievements",
    education: "educations",
    honor: "honors",
  };

  // 库内已入库记录加载（仅选合并所需的字段，fromExisting 会按字段名取用）
  async function loadExisting(kind: SectionKind): Promise<Record<string, unknown>[]> {
    switch (kind) {
      case "work":
        return prisma.careerExperience.findMany({
          where: { userId, deletedAt: null },
          select: { id: true, company: true, title: true, startDate: true, endDate: true, location: true, description: true, highlights: true },
        }) as unknown as Promise<Record<string, unknown>[]>;
      case "project":
        return prisma.project.findMany({
          where: { userId, deletedAt: null },
          select: { id: true, name: true, role: true, startDate: true, endDate: true, description: true, outcome: true, techStack: true, links: true },
        }) as unknown as Promise<Record<string, unknown>[]>;
      case "achievement":
        return prisma.achievement.findMany({
          where: { userId },
          select: { id: true, title: true, metricValue: true, metricUnit: true, metricText: true, evidence: true, occurredAt: true },
        }) as unknown as Promise<Record<string, unknown>[]>;
      case "education":
        return prisma.education.findMany({
          where: { userId },
          select: { id: true, school: true, degree: true, major: true, faculty: true, startDate: true, endDate: true, gpa: true, description: true },
        }) as unknown as Promise<Record<string, unknown>[]>;
      case "honor":
        return prisma.honor.findMany({
          where: { userId },
          select: { id: true, title: true, issuer: true, date: true, description: true },
        }) as unknown as Promise<Record<string, unknown>[]>;
    }
  }

  for (const kind of SECTION_KINDS) {
    const raws = (result[PLURAL[kind]] ?? []) as Record<string, unknown>[];
    const newItems = toNewItems(kind, raws);
    if (!newItems.length) continue;

    const existingRows = await loadExisting(kind);
    const existingItems = toExistingItems(kind, existingRows);
    const existingById = new Map(existingItems.map((e) => [e.id as string, e]));

    // 廉价启发式生成候选对（导入内 + 跨导入），每类上限 15 对以控制 AI 调用量
    const candidates = buildCandidatePairsForKind(kind, newItems, existingItems).slice(0, 15);

    for (const c of candidates) {
      const a = newItems[c.index];
      const b = c.kind === "intra" ? newItems[c.otherIndex!] : existingById.get(c.existingId!);
      if (!b) continue;

      let same = false;
      let confidence: "high" | "mid" | "low" = "low";
      let reason: string | undefined;

      // 工作经历：公司名完全一致（且已判定为候选=时间重叠）→ 直接判同，省一次 AI
      if (kind === "work" && normalizeCompany(a.primary) === normalizeCompany(b.primary)) {
        same = true;
        confidence = "high";
        reason = "公司名完全一致且时间重叠";
      } else {
        const j = await judgeDuplicate(a, b, kind);
        same = j.same;
        confidence = j.confidence;
        reason = j.reason;
      }

      duplicates[kind].push({
        id: c.kind === "intra" ? `intra:${kind}:${c.index}:${c.otherIndex}` : `cross:${kind}:${c.index}:${c.existingId}`,
        index: c.index,
        kind: c.kind,
        section: kind,
        otherIndex: c.otherIndex,
        existingId: c.existingId,
        otherLabel: b.label,
        same,
        confidence,
        reason,
        existing: c.kind === "cross" ? b : undefined,
      });
    }
  }

  for (const [index, skill] of result.skills.entries()) {
    const existingSkill = await prisma.skill.findUnique({
      where: { userId_nameNorm: { userId, nameNorm: normalizeSkill(skill.name) } },
      select: { id: true, name: true },
    });
    if (existingSkill) skills.push({ index, existingId: existingSkill.id, existingLabel: existingSkill.name });
  }
  return { ...duplicates, skills };
}
