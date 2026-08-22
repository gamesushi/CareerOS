import { prisma } from "@careeros/db";
import {
  normalizeCompany,
  normalizeSkill,
  normalizeExtractedDate,
  buildCandidatePairs,
  type ExtractionResult,
  type ExtractedPayload,
  type DupHit,
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
      data: { extracted: payload, status: "review" },
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
  };
}

async function findDuplicates(userId: string, result: ExtractionResult) {
  const experiences: DupHit[] = [];
  const skills: { index: number; existingId: string; existingLabel: string }[] = [];

  const toFields = (e: {
    company: string; title: string;
    startDate?: string | null; endDate?: string | null;
    location?: string | null; description?: string | null; highlights?: string[];
  }) => ({
    company: e.company,
    title: e.title,
    startDate: e.startDate ?? null,
    endDate: e.endDate ?? null,
    location: e.location ?? null,
    description: e.description ?? null,
    highlights: e.highlights ?? [],
  });

  const newExps = result.experiences.map(toFields);

  // 已入库经历（供跨导入查重）
  const existingRows = await prisma.careerExperience.findMany({
    where: { userId, deletedAt: null },
    select: {
      id: true, company: true, title: true,
      startDate: true, endDate: true, location: true, description: true, highlights: true,
    },
  });
  const existing = existingRows.map((r) => ({
    id: r.id,
    company: r.company,
    title: r.title,
    startDate: r.startDate ? r.startDate.toISOString().slice(0, 10) : null,
    endDate: r.endDate ? r.endDate.toISOString().slice(0, 10) : null,
    location: r.location ?? null,
    description: (r.description as string | null) ?? null,
    highlights: (Array.isArray(r.highlights) ? (r.highlights as string[]) : []),
  }));

  // 1. 廉价启发式生成候选对（导入内 + 跨导入）
  const candidates = buildCandidatePairs(newExps, existing).slice(0, 24);

  // 2. 逐对判定：公司名完全一致（且日期已重叠）→ 直接判同，省一次 AI；其余交给 AI 裁判
  for (const c of candidates) {
    const a = newExps[c.index];
    const b = c.kind === "intra" ? newExps[c.otherIndex!] : (c.existing as NonNullable<typeof c.existing>);
    const label = `${b.company} · ${b.title}`;

    let same = false;
    let confidence: "high" | "mid" | "low" = "low";
    let reason: string | undefined;

    if (normalizeCompany(a.company) === normalizeCompany(b.company)) {
      same = true;
      confidence = "high";
      reason = "公司名完全一致且时间重叠";
    } else {
      const j = await judgeDuplicate(a, b);
      same = j.same;
      confidence = j.confidence;
      reason = j.reason;
    }

    experiences.push({
      id: c.kind === "intra" ? `intra:${c.index}:${c.otherIndex}` : `cross:${c.index}:${c.existingId}`,
      index: c.index,
      kind: c.kind,
      otherIndex: c.otherIndex,
      existingId: c.existingId,
      otherLabel: label,
      same,
      confidence,
      reason,
      existing: c.kind === "cross" ? b : undefined,
    });
  }

  for (const [index, skill] of result.skills.entries()) {
    const existingSkill = await prisma.skill.findUnique({
      where: { userId_nameNorm: { userId, nameNorm: normalizeSkill(skill.name) } },
      select: { id: true, name: true },
    });
    if (existingSkill) skills.push({ index, existingId: existingSkill.id, existingLabel: existingSkill.name });
  }
  return { experiences, skills };
}
