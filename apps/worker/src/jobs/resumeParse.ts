import { prisma } from "@careeros/db";
import {
  normalizeCompany,
  normalizeSkill,
  normalizeExtractedDate,
  type ExtractionResult,
  type ExtractedPayload,
} from "@careeros/shared";
import { getObjectBuffer } from "../lib/s3";
import { parseDocument } from "../lib/docreader";
import { runResumeParse, PROMPT_VERSION } from "../ai/tasks/resumeParse";
import { startRun, finishRun } from "../ai/audit";

// 导入管线：pending → parsing(docreader) → extracting(LLM) → review / failed
// 状态即进度，前端 SSE 轮询 resume_imports.status（docs/design/02 §2 状态机）。

export async function handleResumeParseJob(importId: string): Promise<void> {
  const imp = await prisma.resumeImport.findUnique({ where: { id: importId } });
  if (!imp) throw new Error(`导入记录不存在: ${importId}`);
  if (imp.status === "applied") return; // 幂等：已入库的不重跑

  try {
    // 1. docreader 解析
    await prisma.resumeImport.update({ where: { id: importId }, data: { status: "parsing", error: null } });
    const file = await getObjectBuffer(imp.fileKey);
    const markdown = await parseDocument(file, imp.fileName);
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
        endDate: end.date,
        confidence: start.padded || end.padded ? downgrade(e.confidence) : e.confidence,
      };
    }),
    projects: result.projects.map((p) => {
      const start = normalizeExtractedDate(p.startDate);
      const end = normalizeExtractedDate(p.endDate);
      return {
        ...p,
        startDate: start.date,
        endDate: end.date,
        confidence: start.padded || end.padded ? downgrade(p.confidence) : p.confidence,
      };
    }),
    educations: result.educations.map((e) => ({
      ...e,
      startDate: normalizeExtractedDate(e.startDate).date,
      endDate: normalizeExtractedDate(e.endDate).date,
    })),
  };
}

async function findDuplicates(userId: string, result: ExtractionResult) {
  const experiences: { index: number; existingId: string; existingLabel: string }[] = [];
  const skills: { index: number; existingId: string; existingLabel: string }[] = [];

  for (const [index, exp] of result.experiences.entries()) {
    const existing = await prisma.careerExperience.findFirst({
      where: { userId, companyNorm: normalizeCompany(exp.company), deletedAt: null },
      select: { id: true, company: true, title: true },
    });
    if (existing) {
      experiences.push({ index, existingId: existing.id, existingLabel: `${existing.company} · ${existing.title}` });
    }
  }
  for (const [index, skill] of result.skills.entries()) {
    const existing = await prisma.skill.findUnique({
      where: { userId_nameNorm: { userId, nameNorm: normalizeSkill(skill.name) } },
      select: { id: true, name: true },
    });
    if (existing) skills.push({ index, existingId: existing.id, existingLabel: existing.name });
  }
  return { experiences, skills };
}
