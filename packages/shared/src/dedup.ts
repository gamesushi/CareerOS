import { z } from "zod";
import { normalizeCompany } from "./normalize";

// ===== 经历 / 分栏查重合并的纯逻辑层（前后端、worker 共用，无 DB / AI 依赖） =====
// 设计：先用廉价启发式（身份相关 + 时间重叠）生成候选对，再由 worker 侧 AI 按 section 类型判定是否同一实体。
// 本文件只负责 (1) 候选对生成 (2) 判定结果的合并决策归约 (3) 字段级确定性合并。
// 支持 5 类分栏：work(工作经历) / project(项目) / achievement(成果) / education(教育) / honor(荣誉奖项)。

export type SectionKind = "work" | "project" | "achievement" | "education" | "honor";
export const SECTION_KINDS: SectionKind[] = ["work", "project", "achievement", "education", "honor"];

export type DupKind = "intra" | "cross";
export type MergeChoice = "merge" | "keep_existing" | "keep_new" | "keep_both";

/**
 * 合并框架的通用单元。每种分栏在抽取/入库后都会规整成 MergeItem：
 * - primary/secondary 是「身份」字段（如公司名/职位、学校/学位、标题/颁发方），用于启发式候选与展示；
 * - startDate/endDate 是「时间」字段（字符串 YYYY-MM-DD 或 null=至今/开放），用于重叠判定；
 * - raw 是分栏原始字段袋，供确定性 merge 与后端落库映射使用。
 */
export type MergeItem = {
  kind: SectionKind;
  index: number; // 在「本次导入的新分栏数组」中的下标（库内记录无意义，用 id 标识）
  id?: string; // 库内记录主键（cross 候选用）
  primary: string;
  primaryNorm: string;
  secondary: string;
  secondaryNorm: string;
  startDate: string | null;
  endDate: string | null;
  label: string; // 人类可读展示标签
  raw: Record<string, unknown>;
};

/** 单条查重命中：总是以「本次导入的新分栏 index」为主视角 */
export type DupHit = {
  id: string; // 主键（UI 用来挂 choice），同一次导入内唯一
  index: number; // 新分栏在 result[section] 中的下标
  kind: DupKind;
  section: SectionKind;
  otherIndex?: number; // intra：同 section 另一条新分栏下标
  existingId?: string; // cross：已入库记录 id
  otherLabel?: string; // 另一侧展示用标签
  same: boolean; // AI 判定：是否为同一实体
  confidence: "high" | "mid" | "low";
  reason?: string;
  existing?: MergeItem | null; // cross：已入库记录的完整 MergeItem，供合并预览
};

export type WriteOp =
  | { type: "create"; section: SectionKind; item: MergeItem; forceCreate?: boolean }
  | { type: "update"; section: SectionKind; id: string; item: MergeItem }
  | { type: "drop"; section: SectionKind };

export type Candidate = {
  kind: DupKind;
  index: number;
  otherIndex?: number;
  existingId?: string;
};

// ===== 通用工具 =====

function toStr(d: unknown): string | null {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const s = String(d);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s || null;
}

/** 文本归一化：小写、去空白与标点，用于标题/学校/颁发方比较 */
export function textNorm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[\s\-_·•·、，,。.()（）/]/g, "").trim();
}

function arr<T>(x: unknown): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

/** 两个字符串的共有整词数（token 长度≥2 才计入） */
function sharedTokens(a: string, b: string): number {
  const ta = new Set(textNorm(a).split(/[^a-z0-9一-鿿]+/i).filter((t) => t.length >= 2));
  const tb = new Set(textNorm(b).split(/[^a-z0-9一-鿿]+/i).filter((t) => t.length >= 2));
  let n = 0;
  for (const t of ta) if (tb.has(t)) n++;
  return n;
}

function longer(a?: string | null, b?: string | null): string {
  const av = (a ?? "").trim();
  const bv = (b ?? "").trim();
  if (!av) return bv;
  if (!bv) return av;
  return av.length >= bv.length ? av : bv;
}

function earlier(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

function later(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

function unionStr(a?: string[], b?: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of [...arr<string>(a), ...arr<string>(b)]) {
    const t = (h ?? "").trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

function unionObj(a?: unknown[], b?: unknown[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const h of [...arr<unknown>(a), ...arr<unknown>(b)]) {
    const k = JSON.stringify(h);
    if (h != null && !seen.has(k)) {
      seen.add(k);
      out.push(h);
    }
  }
  return out;
}

/** 两条日期区间是否重叠；任一 end 为 null 视为「至今 / 开放区间」 */
export function dateOverlap(
  a: { startDate: string | null; endDate: string | null },
  b: { startDate: string | null; endDate: string | null },
): boolean {
  const as = a.startDate ? a.startDate.slice(0, 7) : null;
  const ae = a.endDate ? a.endDate.slice(0, 7) : null;
  const bs = b.startDate ? b.startDate.slice(0, 7) : null;
  const be = b.endDate ? b.endDate.slice(0, 7) : null;
  if (!as || !bs) return false;
  if (ae && ae < bs) return false;
  if (be && be < as) return false;
  return true;
}

/** 公司名相关度（廉价启发式，用于筛候选对，不替代 AI 判定） */
export function companyRelated(a: string, b: string): boolean {
  const na = normalizeCompany(a);
  const nb = normalizeCompany(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 2 && nb.length >= 2 && (na.includes(nb) || nb.includes(na))) return true;
  const ta = new Set(na.split(/[^a-z0-9一-鿿]+/i).filter((t) => t.length >= 3));
  const tb = new Set(nb.split(/[^a-z0-9一-鿿]+/i).filter((t) => t.length >= 3));
  for (const t of ta) if (tb.has(t)) return true;
  return false;
}

function datesEqual(a: { startDate: string | null; endDate: string | null }, b: { startDate: string | null; endDate: string | null }): boolean {
  return (a.startDate ?? null) === (b.startDate ?? null) && (a.endDate ?? null) === (b.endDate ?? null);
}

// ===== 每类分栏的适配器 =====
// fromNew: 抽取结果 → MergeItem；fromExisting: 库内记录 → MergeItem（带 id）；
// candidate: 廉价候选判定；merge: 确定性字段合并（a 为保留侧，b 为丢弃侧）。

type KindDef = {
  fromNew: (raw: Record<string, any>, index: number) => MergeItem;
  fromExisting: (row: Record<string, any>) => MergeItem;
  candidate: (a: MergeItem, b: MergeItem) => boolean;
  merge: (a: MergeItem, b: MergeItem) => MergeItem;
};

function mk(
  kind: SectionKind,
  partial: Omit<MergeItem, "kind" | "index">,
  index: number,
): MergeItem {
  return { kind, index, ...partial };
}

// 合并后的公共处理：刷新时间区间与 label
function withMergedDates(
  a: MergeItem,
  b: MergeItem,
  raw: Record<string, unknown>,
  label: string,
): MergeItem {
  const startDate = earlier(a.startDate, b.startDate) ?? a.startDate;
  const endDate = !a.endDate || !b.endDate ? null : later(a.endDate, b.endDate);
  return {
    ...a,
    startDate: startDate ?? a.startDate,
    endDate,
    label,
    raw: { ...raw, startDate: startDate ?? a.raw.startDate ?? null, endDate },
  };
}

const SECTION_DEFS: Record<SectionKind, KindDef> = {
  // ---------- 工作经历：公司 + 职位 + 时间 ----------
  work: {
    fromNew: (r, index) => {
      const raw = {
        company: r.company ?? "",
        department: r.department ?? null,
        title: r.title ?? "",
        startDate: toStr(r.startDate) ?? null,
        endDate: toStr(r.endDate) ?? null,
        location: r.location ?? null,
        description: r.description ?? null,
        highlights: arr(r.highlights as string[]),
      };
      return mk("work", {
        primary: raw.company,
        primaryNorm: normalizeCompany(raw.company),
        secondary: raw.title,
        secondaryNorm: textNorm(raw.title),
        startDate: raw.startDate,
        endDate: raw.endDate,
        label: `${raw.company} · ${raw.title}`,
        raw,
      }, index);
    },
    fromExisting: (row) => {
      const raw = {
        company: row.company as string,
        department: (row.department as string) ?? null,
        title: row.title as string,
        startDate: toStr(row.startDate) ?? null,
        endDate: toStr(row.endDate) ?? null,
        location: (row.location as string) ?? null,
        description: (row.description as string) ?? null,
        highlights: arr(row.highlights as string[]),
      };
      return mk("work", {
        id: row.id as string,
        primary: raw.company,
        primaryNorm: normalizeCompany(raw.company),
        secondary: raw.title,
        secondaryNorm: textNorm(raw.title),
        startDate: raw.startDate,
        endDate: raw.endDate,
        label: `${raw.company} · ${raw.title}`,
        raw,
      }, -1);
    },
    candidate: (a, b) => dateOverlap(a, b) && companyRelated(a.primary, b.primary),
    merge: (a, b) => {
      const raw = {
        company: longer(a.raw.company as string, b.raw.company as string),
        department: longer(a.raw.department as string, b.raw.department as string) || null,
        title: longer(a.raw.title as string, b.raw.title as string),
        startDate: a.raw.startDate ?? null,
        endDate: a.raw.endDate ?? null,
        location: longer(a.raw.location as string, b.raw.location as string) || null,
        description: longer(a.raw.description as string, b.raw.description as string) || null,
        highlights: unionStr(a.raw.highlights as string[], b.raw.highlights as string[]),
      };
      return withMergedDates(a, b, raw, `${raw.company} · ${raw.title}`);
    },
  },

  // ---------- 项目：名称 + 所属公司 + 时间 ----------
  project: {
    fromNew: (r, index) => {
      const raw = {
        name: r.name ?? "",
        role: r.role ?? null,
        belongsToCompany: r.belongsToCompany ?? null,
        startDate: toStr(r.startDate) ?? null,
        endDate: toStr(r.endDate) ?? null,
        description: r.description ?? null,
        outcome: r.outcome ?? null,
        techStack: arr(r.techStack as string[]),
        links: arr(r.links as object[]),
      };
      return mk("project", {
        primary: raw.name,
        primaryNorm: textNorm(raw.name),
        secondary: raw.belongsToCompany ?? "",
        secondaryNorm: normalizeCompany(raw.belongsToCompany ?? ""),
        startDate: raw.startDate,
        endDate: raw.endDate,
        label: raw.name,
        raw,
      }, index);
    },
    fromExisting: (row) => {
      const raw = {
        name: row.name as string,
        role: (row.role as string) ?? null,
        belongsToCompany: null,
        startDate: toStr(row.startDate) ?? null,
        endDate: toStr(row.endDate) ?? null,
        description: (row.description as string) ?? null,
        outcome: (row.outcome as string) ?? null,
        techStack: arr(row.techStack as string[]),
        links: arr(row.links as object[]),
      };
      return mk("project", {
        id: row.id as string,
        primary: raw.name,
        primaryNorm: textNorm(raw.name),
        secondary: "",
        secondaryNorm: "",
        startDate: raw.startDate,
        endDate: raw.endDate,
        label: raw.name,
        raw,
      }, -1);
    },
    candidate: (a, b) =>
      dateOverlap(a, b) &&
      (textNorm(a.primary) === textNorm(b.primary) ||
        (a.secondaryNorm !== "" && b.secondaryNorm !== "" && companyRelated(a.secondary, b.secondary))),
    merge: (a, b) => {
      const raw = {
        name: longer(a.raw.name as string, b.raw.name as string),
        role: longer(a.raw.role as string, b.raw.role as string) || null,
        belongsToCompany: (a.raw.belongsToCompany as string) ?? null,
        startDate: a.raw.startDate ?? null,
        endDate: a.raw.endDate ?? null,
        description: longer(a.raw.description as string, b.raw.description as string) || null,
        outcome: longer(a.raw.outcome as string, b.raw.outcome as string) || null,
        techStack: unionStr(a.raw.techStack as string[], b.raw.techStack as string[]),
        links: unionObj(a.raw.links as object[], b.raw.links as object[]),
      };
      return withMergedDates(a, b, raw, raw.name);
    },
  },

  // ---------- 成果：标题 + 时间（量化表述，通常唯一，但跨导入可能重复） ----------
  achievement: {
    fromNew: (r, index) => {
      const raw = {
        title: r.title ?? "",
        metricValue: r.metricValue ?? null,
        metricUnit: r.metricUnit ?? null,
        metricText: r.metricText ?? null,
        evidence: r.evidence ?? null,
        occurredAt: toStr(r.occurredAt) ?? toStr(r.date) ?? null,
      };
      return mk("achievement", {
        primary: raw.title,
        primaryNorm: textNorm(raw.title),
        secondary: "",
        secondaryNorm: "",
        startDate: raw.occurredAt,
        endDate: raw.occurredAt,
        label: raw.title,
        raw,
      }, index);
    },
    fromExisting: (row) => {
      const raw = {
        title: row.title as string,
        metricValue: (row.metricValue as number) ?? null,
        metricUnit: (row.metricUnit as string) ?? null,
        metricText: (row.metricText as string) ?? null,
        evidence: (row.evidence as string) ?? null,
        occurredAt: toStr(row.occurredAt) ?? null,
      };
      return mk("achievement", {
        id: row.id as string,
        primary: raw.title,
        primaryNorm: textNorm(raw.title),
        secondary: "",
        secondaryNorm: "",
        startDate: raw.occurredAt,
        endDate: raw.occurredAt,
        label: raw.title,
        raw,
      }, -1);
    },
    candidate: (a, b) =>
      textNorm(a.primary) === textNorm(b.primary) ||
      (sharedTokens(a.primary, b.primary) >= 2 && datesEqual(a, b)),
    merge: (a, b) => {
      const raw = {
        title: longer(a.raw.title as string, b.raw.title as string),
        metricValue: (a.raw.metricValue as number) ?? (b.raw.metricValue as number) ?? null,
        metricUnit: (a.raw.metricUnit as string) ?? (b.raw.metricUnit as string) ?? null,
        metricText: longer(a.raw.metricText as string, b.raw.metricText as string) || null,
        evidence: longer(a.raw.evidence as string, b.raw.evidence as string) || null,
        occurredAt: earlier(a.startDate, b.startDate) ?? a.startDate,
      };
      return {
        ...a,
        startDate: raw.occurredAt,
        endDate: raw.occurredAt,
        label: raw.title,
        raw,
      };
    },
  },

  // ---------- 教育：学校 + 学位 + 时间 ----------
  education: {
    fromNew: (r, index) => {
      const raw = {
        school: r.school ?? "",
        degree: r.degree ?? null,
        major: r.major ?? null,
        faculty: r.faculty ?? null,
        startDate: toStr(r.startDate) ?? null,
        endDate: toStr(r.endDate) ?? null,
        gpa: r.gpa ?? null,
        description: r.description ?? null,
      };
      return mk("education", {
        primary: raw.school,
        primaryNorm: textNorm(raw.school),
        secondary: raw.degree ?? "",
        secondaryNorm: textNorm(raw.degree ?? ""),
        startDate: raw.startDate,
        endDate: raw.endDate,
        label: [raw.school, raw.degree].filter(Boolean).join(" · "),
        raw,
      }, index);
    },
    fromExisting: (row) => {
      const raw = {
        school: row.school as string,
        degree: (row.degree as string) ?? null,
        major: (row.major as string) ?? null,
        faculty: (row.faculty as string) ?? null,
        startDate: toStr(row.startDate) ?? null,
        endDate: toStr(row.endDate) ?? null,
        gpa: (row.gpa as string) ?? null,
        description: (row.description as string) ?? null,
      };
      return mk("education", {
        id: row.id as string,
        primary: raw.school,
        primaryNorm: textNorm(raw.school),
        secondary: raw.degree ?? "",
        secondaryNorm: textNorm(raw.degree ?? ""),
        startDate: raw.startDate,
        endDate: raw.endDate,
        label: [raw.school, raw.degree].filter(Boolean).join(" · "),
        raw,
      }, -1);
    },
    candidate: (a, b) => a.primaryNorm === b.primaryNorm && (dateOverlap(a, b) || a.secondaryNorm === b.secondaryNorm),
    merge: (a, b) => {
      const raw = {
        school: longer(a.raw.school as string, b.raw.school as string),
        degree: longer(a.raw.degree as string, b.raw.degree as string) || null,
        major: longer(a.raw.major as string, b.raw.major as string) || null,
        faculty: (a.raw.faculty as string) ?? null,
        startDate: a.raw.startDate ?? null,
        endDate: a.raw.endDate ?? null,
        gpa: longer(a.raw.gpa as string, b.raw.gpa as string) || null,
        description: longer(a.raw.description as string, b.raw.description as string) || null,
      };
      const label = [raw.school, raw.degree].filter(Boolean).join(" · ");
      return withMergedDates(a, b, raw, label);
    },
  },

  // ---------- 荣誉奖项：标题 + 颁发方 + 时间 ----------
  honor: {
    fromNew: (r, index) => {
      const raw = {
        title: r.title ?? "",
        issuer: r.issuer ?? null,
        date: toStr(r.date) ?? toStr(r.occurredAt) ?? null,
        description: r.description ?? null,
      };
      return mk("honor", {
        primary: raw.title,
        primaryNorm: textNorm(raw.title),
        secondary: raw.issuer ?? "",
        secondaryNorm: textNorm(raw.issuer ?? ""),
        startDate: raw.date,
        endDate: raw.date,
        label: [raw.title, raw.issuer].filter(Boolean).join(" · "),
        raw,
      }, index);
    },
    fromExisting: (row) => {
      const raw = {
        title: row.title as string,
        issuer: (row.issuer as string) ?? null,
        date: toStr(row.date) ?? null,
        description: (row.description as string) ?? null,
      };
      return mk("honor", {
        id: row.id as string,
        primary: raw.title,
        primaryNorm: textNorm(raw.title),
        secondary: raw.issuer ?? "",
        secondaryNorm: textNorm(raw.issuer ?? ""),
        startDate: raw.date,
        endDate: raw.date,
        label: [raw.title, raw.issuer].filter(Boolean).join(" · "),
        raw,
      }, -1);
    },
    candidate: (a, b) =>
      a.primaryNorm === b.primaryNorm &&
      (a.secondaryNorm === b.secondaryNorm || datesEqual(a, b)),
    merge: (a, b) => {
      const raw = {
        title: longer(a.raw.title as string, b.raw.title as string),
        issuer: longer(a.raw.issuer as string, b.raw.issuer as string) || null,
        date: earlier(a.startDate, b.startDate) ?? a.startDate,
        description: longer(a.raw.description as string, b.raw.description as string) || null,
      };
      const label = [raw.title, raw.issuer].filter(Boolean).join(" · ");
      return { ...a, startDate: raw.date, endDate: raw.date, label, raw };
    },
  },
};

// ===== 通用入口 =====

/** 把「本次导入的某类分栏原始数组」规整为 MergeItem[] */
export function toNewItems(kind: SectionKind, raws: Record<string, any>[]): MergeItem[] {
  return (raws ?? []).map((r, i) => SECTION_DEFS[kind].fromNew(r, i));
}

/** 把「库内已入库记录」规整为 MergeItem[]（带 id） */
export function toExistingItems(kind: SectionKind, rows: Record<string, any>[]): MergeItem[] {
  return (rows ?? []).map((r) => SECTION_DEFS[kind].fromExisting(r));
}

/** 按分栏类型的廉价「是否同一实体」候选判定（供 apply 竞态合并复用） */
export function sectionCandidate(kind: SectionKind, a: MergeItem, b: MergeItem): boolean {
  return SECTION_DEFS[kind].candidate(a, b);
}

/** 候选对生成（不调用 AI）：导入内两两 + 与已入库记录 */
export function buildCandidatePairsForKind(
  kind: SectionKind,
  newItems: MergeItem[],
  existingItems: MergeItem[],
): Candidate[] {
  const def = SECTION_DEFS[kind];
  const pairs: Candidate[] = [];
  // 导入内两两
  for (let i = 0; i < newItems.length; i++) {
    for (let j = i + 1; j < newItems.length; j++) {
      if (def.candidate(newItems[i], newItems[j])) {
        pairs.push({ kind: "intra", index: i, otherIndex: j });
      }
    }
  }
  // 与已入库记录（每个新分栏最多 3 个跨库候选，控制 AI 调用量）
  for (let i = 0; i < newItems.length; i++) {
    let matched = 0;
    for (const e of existingItems) {
      if (matched >= 3) break;
      if (def.candidate(newItems[i], e)) {
        pairs.push({ kind: "cross", index: i, existingId: e.id });
        matched++;
      }
    }
  }
  return pairs;
}

/** 确定性字段合并（AI 只判定「是否同一实体」，字段合并用确定性规则，便于玩家复核） */
export function mergeItems(kind: SectionKind, a: MergeItem, b: MergeItem): MergeItem {
  return SECTION_DEFS[kind].merge(a, b);
}

// ===== 归约：把「查重命中 + 玩家选择」折叠成最终写操作（按 section 分组） =====

export function defaultChoice(_hit: DupHit): MergeChoice {
  return "merge";
}

export type SectionApplyInput = {
  kind: SectionKind;
  items: MergeItem[];
  hits: DupHit[];
  choices: Record<string, MergeChoice>;
  include?: boolean[];
};

export type SectionApplyResult = { ops: WriteOp[]; dropped: number[] };

export function buildApplySections(sections: SectionApplyInput[]): Record<SectionKind, SectionApplyResult> {
  const out = {} as Record<SectionKind, SectionApplyResult>;
  for (const sec of sections) {
    out[sec.kind] = applyOne(sec);
  }
  return out;
}

function applyOne(sec: SectionApplyInput): SectionApplyResult {
  const { kind, items, hits, choices, include } = sec;
  const fate = new Map<number, WriteOp>();
  const dropped: number[] = [];

  const getChoice = (hit: DupHit): MergeChoice => choices[hit.id] ?? defaultChoice(hit);

  for (const hit of hits) {
    if (!hit.same) continue;
    if (hit.kind === "intra") {
      const a = items[hit.index];
      const b = items[hit.otherIndex!];
      if (!a || !b) continue;
      const choice = getChoice(hit);
      if (choice === "keep_both") continue; // 两条都按正常 create 走
      const merged = mergeItems(kind, a, b);
      fate.set(hit.index, { type: "create", section: kind, item: merged });
      fate.set(hit.otherIndex!, { type: "drop", section: kind });
      dropped.push(hit.otherIndex!);
    } else {
      const a = items[hit.index];
      const existing = hit.existing;
      if (!a) continue;
      const choice = getChoice(hit);
      switch (choice) {
        case "keep_existing":
          fate.set(hit.index, { type: "drop", section: kind });
          dropped.push(hit.index);
          break;
        case "keep_both":
          fate.set(hit.index, { type: "create", section: kind, item: a, forceCreate: true });
          break;
        case "keep_new":
          fate.set(hit.index, { type: "update", section: kind, id: hit.existingId!, item: a });
          break;
        case "merge":
        default:
          fate.set(hit.index, {
            type: "update",
            section: kind,
            id: hit.existingId!,
            item: existing ? mergeItems(kind, a, existing) : a,
          });
          break;
      }
    }
  }

  const ops: WriteOp[] = [];
  for (let i = 0; i < items.length; i++) {
    const f = fate.get(i);
    if (f) {
      ops.push(f);
      if (f.type === "drop") dropped.push(i);
      continue;
    }
    if (include && include[i] === false) {
      ops.push({ type: "drop", section: kind });
      dropped.push(i);
      continue;
    }
    ops.push({ type: "create", section: kind, item: items[i] });
  }
  return { ops, dropped };
}

// ===== schema（供 extractedPayload 复用） =====
export const dupHitSchema = z.object({
  id: z.string(),
  index: z.number(),
  kind: z.enum(["intra", "cross"]),
  section: z.enum(["work", "project", "achievement", "education", "honor"]),
  otherIndex: z.number().optional(),
  existingId: z.string().optional(),
  otherLabel: z.string().optional(),
  same: z.boolean(),
  confidence: z.enum(["high", "mid", "low"]),
  reason: z.string().optional(),
  existing: z
    .object({
      kind: z.enum(["work", "project", "achievement", "education", "honor"]),
      index: z.number(),
      primary: z.string(),
      primaryNorm: z.string(),
      secondary: z.string(),
      secondaryNorm: z.string(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      label: z.string(),
      raw: z.record(z.unknown()),
    })
    .nullable()
    .optional(),
});

export type DupHitType = z.infer<typeof dupHitSchema>;
