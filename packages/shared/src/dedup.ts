import { z } from "zod";
import { normalizeCompany } from "./normalize";

// ===== 经历查重 / 合并的纯逻辑层（前后端、worker 共用，无 DB / AI 依赖） =====
// 设计：先用廉价启发式（日期重叠 + 公司名相关）生成候选对，再由 worker 侧 AI 判定是否同一段真实经历。
// 本文件只负责 (1) 候选对生成 (2) 判定结果的合并决策归约 (3) 字段级确定性合并。

export type ExpFields = {
  company: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  location?: string | null;
  description?: string | null;
  highlights?: string[];
};

export type DupKind = "intra" | "cross";
export type MergeChoice = "merge" | "keep_existing" | "keep_new" | "keep_both";

/** 单条查重命中：总是以「本次导入的新经历 index」为主视角 */
export type DupHit = {
  /** 主键（UI 用来挂 choice），同一次导入内唯一 */
  id: string;
  /** 新经历在 result.experiences 中的下标 */
  index: number;
  kind: DupKind;
  /** intra：另一条新经历下标 */
  otherIndex?: number;
  /** cross：已入库 careerExperience 的 id */
  existingId?: string;
  /** 另一侧展示用标签 */
  otherLabel?: string;
  /** AI 判定：是否为同一段真实经历 */
  same: boolean;
  confidence: "high" | "mid" | "low";
  reason?: string;
  /** cross：已入库记录的完整字段，供合并预览；intra 可由 exps[otherIndex] 推导 */
  existing?: ExpFields | null;
};

export type WriteOp =
  | { type: "create"; exp: ExpFields; forceCreate?: boolean }
  | { type: "update"; id: string; exp: ExpFields }
  | { type: "drop" };

// ===== 日期工具 =====
function ym(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(s);
  if (!m) return null;
  return `${m[1]}-${m[2] ?? "01"}`;
}

/** 两条日期区间是否重叠；任一 end 为 null 视为「至今 / 开放区间」 */
export function dateOverlap(
  a: { startDate: string | null; endDate: string | null },
  b: { startDate: string | null; endDate: string | null },
): boolean {
  const as = ym(a.startDate);
  const ae = ym(a.endDate);
  const bs = ym(b.startDate);
  const be = ym(b.endDate);
  if (!as || !bs) return false;
  // a 在 b 开始之前结束 → 不重叠；b 在 a 开始之前结束 → 不重叠
  if (ae && ae < bs) return false;
  if (be && be < as) return false;
  return true;
}

// ===== 公司名相关度（廉价启发式，用于筛候选对，不替代 AI 判定） =====
function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9一-鿿]+/i)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function companyRelated(a: string, b: string): boolean {
  const na = normalizeCompany(a);
  const nb = normalizeCompany(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // 包含关系：长名完整包含短名（如「腾讯科技（深圳）」↔「腾讯科技」、「网易游戏」↔「网易」）
  if (na.length >= 2 && nb.length >= 2 && (na.includes(nb) || nb.includes(na))) return true;
  // 至少一个 ≥3 字符的整词相同（如 netease games ↔ netease）
  const ta = new Set(tokenize(na));
  const tb = new Set(tokenize(nb));
  for (const t of ta) {
    if (t.length >= 3 && tb.has(t)) return true;
  }
  return false;
}

// ===== 候选对生成（不调用 AI） =====
export type Candidate = { kind: DupKind; index: number; otherIndex?: number; existingId?: string; existing?: ExpFields | null };

export function buildCandidatePairs(
  exps: ExpFields[],
  existing: (ExpFields & { id: string })[],
): Candidate[] {
  const pairs: Candidate[] = [];
  // 导入内两两
  for (let i = 0; i < exps.length; i++) {
    for (let j = i + 1; j < exps.length; j++) {
      if (dateOverlap(exps[i], exps[j]) && companyRelated(exps[i].company, exps[j].company)) {
        pairs.push({ kind: "intra", index: i, otherIndex: j });
      }
    }
  }
  // 与已入库记录
  for (let i = 0; i < exps.length; i++) {
    let matched = 0;
    for (const e of existing) {
      if (matched >= 3) break; // 每个新经历最多 3 个跨库候选，控制 AI 调用量
      if (dateOverlap(exps[i], e) && companyRelated(exps[i].company, e.company)) {
        pairs.push({ kind: "cross", index: i, existingId: e.id, existing: e });
        matched++;
      }
    }
  }
  return pairs;
}

// ===== 字段级确定性合并（AI 只判定「是否同一段」，字段合并用确定性规则，便于玩家复核） =====
export function mergeFields(x: ExpFields, y: ExpFields): ExpFields {
  const longer = (a?: string | null, b?: string | null) => {
    const av = (a ?? "").trim();
    const bv = (b ?? "").trim();
    if (!av) return bv;
    if (!bv) return av;
    return av.length >= bv.length ? av : bv;
  };
  const earlier = (a: string | null, b: string | null) => {
    if (!a) return b;
    if (!b) return a;
    return a <= b ? a : b;
  };
  const later = (a: string | null, b: string | null) => {
    if (!a) return b;
    if (!b) return a;
    return a >= b ? a : b;
  };
  const unionHighlights = (a?: string[], b?: string[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const h of [...(a ?? []), ...(b ?? [])]) {
      const t = h.trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    return out;
  };
  return {
    company: longer(x.company, y.company),
    title: longer(x.title, y.title),
    startDate: earlier(x.startDate, y.startDate) ?? x.startDate,
    // 任一端为「至今 / 开放」(null) → 合并后仍是开放
    endDate: !x.endDate || !y.endDate ? null : later(x.endDate, y.endDate),
    location: longer(x.location, y.location) || undefined,
    description: longer(x.description, y.description) || undefined,
    highlights: unionHighlights(x.highlights, y.highlights),
  };
}

// ===== 归约：把「查重命中 + 玩家选择」折叠成最终写操作 =====
export function defaultChoice(hit: DupHit): MergeChoice {
  return "merge";
}

export function buildApplyExperiences(
  exps: ExpFields[],
  duplicates: DupHit[],
  choices: Record<string, MergeChoice>,
  include?: boolean[],
): { ops: WriteOp[]; dropped: number[] } {
  // index -> 已确定的命运
  const fate = new Map<number, WriteOp>();
  const dropped: number[] = [];

  const getChoice = (hit: DupHit): MergeChoice => choices[hit.id] ?? defaultChoice(hit);

  for (const hit of duplicates) {
    if (!hit.same) continue;
    if (hit.kind === "intra") {
      const a = exps[hit.index];
      const b = exps[hit.otherIndex!];
      if (!a || !b) continue;
      const choice = getChoice(hit);
      if (choice === "keep_both") continue; // 两条都按正常 create 走
      // merge：保留 index 端、合并 b 的字段、丢弃 b
      const merged = mergeFields(a, b);
      fate.set(hit.index, { type: "create", exp: merged });
      fate.set(hit.otherIndex!, { type: "drop" });
      dropped.push(hit.otherIndex!);
    } else {
      const a = exps[hit.index];
      const existing = hit.existing;
      if (!a) continue;
      const choice = getChoice(hit);
      switch (choice) {
        case "keep_existing":
          fate.set(hit.index, { type: "drop" });
          dropped.push(hit.index);
          break;
        case "keep_both":
          // 跨导入明确「两者都保留」：强制新建，绕过入库时的同公司竞态兜底
          fate.set(hit.index, { type: "create", exp: a, forceCreate: true });
          break;
        case "keep_new":
          fate.set(hit.index, { type: "update", id: hit.existingId!, exp: a });
          break;
        case "merge":
        default:
          fate.set(hit.index, {
            type: "update",
            id: hit.existingId!,
            exp: existing ? mergeFields(a, existing) : a,
          });
          break;
      }
    }
  }

  const ops: WriteOp[] = [];
  for (let i = 0; i < exps.length; i++) {
    const f = fate.get(i);
    if (f) {
      ops.push(f);
      if (f.type === "drop") dropped.push(i);
      continue;
    }
    // 未被查重命中：遵循玩家的 include 开关
    if (include && include[i] === false) {
      ops.push({ type: "drop" });
      dropped.push(i);
      continue;
    }
    ops.push({ type: "create", exp: exps[i] });
  }
  return { ops, dropped };
}

// ===== schema（供 extractedPayload 复用） =====
export const dupHitSchema = z.object({
  id: z.string(),
  index: z.number(),
  kind: z.enum(["intra", "cross"]),
  otherIndex: z.number().optional(),
  existingId: z.string().optional(),
  otherLabel: z.string().optional(),
  same: z.boolean(),
  confidence: z.enum(["high", "mid", "low"]),
  reason: z.string().optional(),
  existing: z
    .object({
      company: z.string(),
      title: z.string(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      location: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      highlights: z.array(z.string()).optional(),
    })
    .nullable()
    .optional(),
});

export type DupHitType = z.infer<typeof dupHitSchema>;
